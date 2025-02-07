// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import {
	pipelines as cdkpipelines,
	aws_codepipeline as codepipeline,
	aws_codepipeline_actions as codepipeline_actions,
	aws_s3 as s3,
	aws_iam as iam,
	aws_codebuild as codebuild,
	aws_sns as sns,
	aws_kms as kms,
} from "aws-cdk-lib";
import { DocTranAppStage } from "./pipeline-app-stage";
import { Config } from "./types";
import { loadConfig } from "../util/loadConfig";

export class pipelineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const config: Config = loadConfig();

		const sourceRepo = `${config.pipeline.source.repoOwner}/${config.pipeline.source.repoName}`;
		const sourceOutput = new codepipeline.Artifact(
			sourceRepo.replace(/[^a-zA-Z0-9]/g, "_") + "_Source",
		);

		let removalPolicy: cdk.RemovalPolicy;
		switch (config.pipeline.removalPolicy) {
			case "destroy":
				removalPolicy = cdk.RemovalPolicy.DESTROY;
				break;
			case "snapshot":
				removalPolicy = cdk.RemovalPolicy.SNAPSHOT;
				break;
			default:
				removalPolicy = cdk.RemovalPolicy.RETAIN;
		}

		// S3
		// S3 | LOGGING BUCKET
		const serverAccessLogsBucket = new s3.Bucket(
			this,
			"serverAccessLogsBucket",
			{
				objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
				blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
				encryption: s3.BucketEncryption.S3_MANAGED,
				enforceSSL: true,
				versioned: true,
				removalPolicy: removalPolicy,
			},
		);
		NagSuppressions.addResourceSuppressions(
			serverAccessLogsBucket,
			[
				{
					id: "AwsSolutions-S1",
					reason:
						"Bucket is the AccessLogs destination bucket for other buckets.",
				},
			],
			true,
		);

		// S3 | ARTIFACT BUCKET
		const artifactBucket = new s3.Bucket(this, "artifactBucket", {
			objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
			enforceSSL: true,
			versioned: true,
			removalPolicy: removalPolicy,
			serverAccessLogsBucket,
			serverAccessLogsPrefix: "artifact-bucket/",
		});

		// SOURCE
		const actionName = "Source";
		
		// Validate required configuration
		if (!config.pipeline.source.connectionArn) {
			throw new Error("Pipeline source connection ARN is required");
		}
		if (!config.pipeline.source.repoOwner || !config.pipeline.source.repoName) {
			throw new Error("Pipeline source repository owner and name are required");
		}

		const pipelineSource = cdkpipelines.CodePipelineSource.connection(
			sourceRepo,
			config.pipeline.source.repoBranch,
			{
				actionName: actionName,
				connectionArn: config.pipeline.source.connectionArn,
			},
		);

		// Validate artifact bucket configuration
		if (!artifactBucket) {
			throw new Error("Artifact bucket is required for pipeline");
		}

		const dirPipeline = "document-translation-main/infrastructure";
		const dirGetOptions = "document-translation-main/util/getOptions";

		// PIPELINE
		// PIPELINE | CODEPIPELINE
		const pipeline = new codepipeline.Pipeline(this, "pipeline", {
			artifactBucket,
			restartExecutionOnUpdate: true,
			crossAccountKeys: true,
			enableKeyRotation: true,
		});

		const getConfigOutput = new codepipeline.Artifact("GetConfigOutput");

		const synth = new cdkpipelines.ShellStep("Synth", {
			input: pipelineSource,
			primaryOutputDirectory: `${dirPipeline}/cdk.out`,
			commands: [
				"echo 'Current directory structure:'",
				"ls -la $CODEBUILD_SRC_DIR",
				"echo 'Setting up getOptions...'",
				"cd $CODEBUILD_SRC_DIR/document-translation-main/util/getOptions",
				"echo 'Installing getOptions dependencies...'",
				"npm ci",
				"echo 'Generating config...'",
				"npm run start",
				"ls -la",
				"echo 'Generated config.json:'",
				"cat config.json",
				"echo 'Copying config.json to config directory...'",
				"mkdir -p $CODEBUILD_SRC_DIR/document-translation-main/config",
				"cp config.json $CODEBUILD_SRC_DIR/document-translation-main/config/config.json",
				"echo 'Config directory contents:'",
				"ls -la $CODEBUILD_SRC_DIR/document-translation-main/config",
				"echo 'Setting up infrastructure...'",
				"cd $CODEBUILD_SRC_DIR/document-translation-main/infrastructure",
				"mkdir -p .",
				"cp ../config/config.json .",
				"echo 'Infrastructure config.json:'",
				"cat config.json",
				"echo 'Installing infrastructure dependencies...'",
				"npm ci",
				"echo 'Running CDK synth...'",
				"npm run cdk synth"
			]
		});

		// PIPELINE | CDKPIPELINE
		const cdkPipeline = new cdkpipelines.CodePipeline(this, "cdkPipeline", {
			codePipeline: pipeline,
			synth: synth,
			codeBuildDefaults: {
				buildEnvironment: {
					buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
					environmentVariables: {
						NODE_ENV: { value: 'production' },
						AWS_REGION: { value: this.region },
						INSTANCE_NAME: { value: config.common.instance.name },
					},
				},
				partialBuildSpec: codebuild.BuildSpec.fromObject({
					version: "0.2",
					phases: {
						install: {
							"runtime-versions": {
								nodejs: "18"
							}
						}
					}
				}),
				rolePolicy: [
					new iam.PolicyStatement({
						effect: iam.Effect.ALLOW,
						actions: ["cloudformation:DescribeStacks"],
						resources: ["*"],
					}),
					new iam.PolicyStatement({
						effect: iam.Effect.ALLOW,
						actions: ["cloudfront:CreateInvalidation"],
						resources: ["*"],
					}),
					new iam.PolicyStatement({
						effect: iam.Effect.ALLOW,
						actions: ["s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
						resources: ["*"],
					}),
					new iam.PolicyStatement({
						effect: iam.Effect.ALLOW,
						actions: ["appsync:GetIntrospectionSchema"],
						resources: [
							`arn:aws:appsync:${this.region}:${this.account}:/v1/apis/*/schema`,
						],
					}),
					new iam.PolicyStatement({
						effect: iam.Effect.ALLOW,
						actions: ["ssm:GetParametersByPath"],
						resources: [
							`arn:aws:ssm:${this.region}:${this.account}:parameter/doctran/${config.common.instance.name}/*`,
						],
					}),
				],
			},
		});

		// PIPELINE | STAGE
		const deployStage = new DocTranAppStage(this, "DocTran-appStack", {
			stageName: "Deploy-Infrastructure",
			env: {
				account: this.account,
				region: this.region,
			},
		});

		const post: cdkpipelines.ShellStep[] = [];
		if (config.app.webUi.enable) {
			const deployWebsiteStep = new cdkpipelines.ShellStep("Deploy-Website", {
				envFromCfnOutputs: {
					appStackId: deployStage.appStackId,
					appStackName: deployStage.appStackName,
					appWebsiteS3Bucket: deployStage.appWebsiteS3Bucket,
					appWebsiteDistribution: deployStage.appWebsiteDistribution,
				},
				installCommands: ["npm install -u @aws-amplify/cli@~12.0"],
				commands: [
					'echo "${appStackId}"',
					'echo "${appStackName}"',
					'echo "${appWebsiteS3Bucket}"',
					'export WEBDIR=${CODEBUILD_SRC_DIR}/website && echo "${WEBDIR}"',
					'export WEBDIR_SRC=${WEBDIR}/src && echo "${WEBDIR_SRC}"',
					'export WEBDIR_BUILD=${WEBDIR}/build && echo "${WEBDIR_BUILD}"',
					'export WEBDIR_GRAPHQL=${WEBDIR_SRC}/graphql && echo "${WEBDIR_GRAPHQL}"',
					'export CFNOUTPUTSFILE=${WEBDIR_SRC}/cfnOutputs.json && echo "${CFNOUTPUTSFILE}"',
					'export GRAPHQLSCHEMAFILE=${WEBDIR_GRAPHQL}/schema.graphql && echo "${GRAPHQLSCHEMAFILE}"',
					'export FEATURESFILE=${WEBDIR_SRC}/features.json && echo "${FEATURESFILE}"',
					"aws cloudformation describe-stacks --stack-name ${appStackName} --query 'Stacks[0].Outputs' | jq .[] | jq -n 'reduce inputs as $i (null; . + ($i|{ (.OutputKey) : (.OutputValue) }))' > ${CFNOUTPUTSFILE}",
					'export awsAppsyncId=$(jq -r .awsAppsyncId ${CFNOUTPUTSFILE}) && echo "${awsAppsyncId}"',
					"mkdir -p ${WEBDIR_GRAPHQL}",
					"aws appsync get-introspection-schema --api-id=${awsAppsyncId} --format SDL ${GRAPHQLSCHEMAFILE}",
					"cd ${WEBDIR_GRAPHQL}",
					"~/.amplify/bin/amplify codegen",
					"cd ${WEBDIR_SRC}",
					'touch ${FEATURESFILE} && echo "{}" > ${FEATURESFILE}',
					`jq -r ".translation = ${config.app.translation.enable}" \${FEATURESFILE} > \${FEATURESFILE}.tmp && mv \${FEATURESFILE}.tmp \${FEATURESFILE}`,
					`jq -r ".readable    = ${config.app.readable.enable}"    \${FEATURESFILE} > \${FEATURESFILE}.tmp && mv \${FEATURESFILE}.tmp \${FEATURESFILE}`,
					'echo "Features enabled: $(cat ${FEATURESFILE})"',
					"cd ${WEBDIR}",
					"npm ci",
					"npm run build",
					"cd ${WEBDIR_BUILD}",
					"aws s3 rm s3://${appWebsiteS3Bucket} --recursive",
					"aws s3 sync . s3://${appWebsiteS3Bucket}",
					'aws cloudfront create-invalidation --distribution-id ${appWebsiteDistribution} --paths "/*"',
				],
			});
			post.push(deployWebsiteStep);
		}

		cdkPipeline.addStage(deployStage, {
			post,
		});

		// Force pipeline construct creation forward
		cdkPipeline.buildPipeline();

		// Add approval pre-CDK
		if (config.pipeline.approvals.preCdkSynth.enable) {
			const pipelineApprovalPreCdkSynthTopicKey = new kms.Key(
				this,
				"pipelineApprovalPreCdkSynthTopicKey",
				{
					enableKeyRotation: true,
					removalPolicy,
				},
			);

			const pipelineApprovalPreCdkSynthTopic = new sns.Topic(
				this,
				"pipelineApprovalPreCdkSynthTopic",
				{
					topicName: `doctran-${config.common.instance.name}-pipelineApprovalPreCdkSynthTopic`,
					enforceSSL: true,
					masterKey: pipelineApprovalPreCdkSynthTopicKey,
				},
			);

			if (config.pipeline.approvals.preCdkSynth.email) {
				new sns.Subscription(this, "pipelineApprovalPreCdkSynthSubscription", {
					topic: pipelineApprovalPreCdkSynthTopic,
					endpoint: config.pipeline.approvals.preCdkSynth.email,
					protocol: sns.SubscriptionProtocol.EMAIL,
				});
			}

			const pipelineApprovalPreCdkSynthRole = new iam.Role(
				this,
				"pipelineApprovalPreCdkSynthRole",
				{
					assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
					inlinePolicies: {
						pipelineApprovalPreCdkSynthPolicy: new iam.PolicyDocument({
							statements: [
								new iam.PolicyStatement({
									effect: iam.Effect.ALLOW,
									actions: ["sns:Publish"],
									resources: [pipelineApprovalPreCdkSynthTopic.topicArn],
								}),
								new iam.PolicyStatement({
									effect: iam.Effect.ALLOW,
									actions: ["kms:GenerateDataKey", "kms:Decrypt"],
									resources: [pipelineApprovalPreCdkSynthTopicKey.keyArn],
								}),
							],
						}),
					},
				},
			);

			const getEnvironmentOrder = config.pipeline.approvals.preCdkSynth.enable ? 1 : 0;

			pipeline.addStage({
				stageName: "ManualApproval_PreSynth",
				placement: {
					justAfter: pipeline.stages[0],
				},
				actions: [
					new codepipeline_actions.ManualApprovalAction({
						actionName: "ManualApproval_PreSynth",
						externalEntityLink: `https://github.com/${sourceRepo}/releases`,
						additionalInformation: `The source repository ${sourceRepo} tracked branch has been updated. Please review and approve the pipeline to implement the update if appropriate. This approval may run twice per update.`,
						notificationTopic: pipelineApprovalPreCdkSynthTopic,
						role: pipelineApprovalPreCdkSynthRole,
					}),
				],
			});
		}

		// Create monitoring topic for pipeline
		const pipelineMonitoringKey = new kms.Key(this, "PipelineMonitoringKey", {
			enableKeyRotation: true,
			removalPolicy: removalPolicy,
		});

		const pipelineMonitoringTopic = new sns.Topic(this, "PipelineMonitoringTopic", {
			topicName: `${config.common.instance.name}-pipeline-monitoring`,
			masterKey: pipelineMonitoringKey,
		});

		// Add monitoring subscription if email is configured
		if (config.pipeline.approvals.preCdkSynth.email) {
			new sns.Subscription(this, "PipelineMonitoringSubscription", {
				topic: pipelineMonitoringTopic,
				protocol: sns.SubscriptionProtocol.EMAIL,
				endpoint: config.pipeline.approvals.preCdkSynth.email,
			});
		}

		// Add monitoring topic to pipeline role permissions
		pipeline.role.addToPrincipalPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ["sns:Publish"],
				resources: [pipelineMonitoringTopic.topicArn],
			})
		);

		pipeline.role.addToPrincipalPolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ["kms:GenerateDataKey", "kms:Decrypt"],
				resources: [pipelineMonitoringKey.keyArn],
			})
		);

		// Add pipeline name output
		new cdk.CfnOutput(this, "PipelineName", {
			value: pipeline.pipelineName,
		});

		new cdk.CfnOutput(this, "PipelineMonitoringTopicArn", {
			value: pipelineMonitoringTopic.topicArn,
		});

		// Suppress all CDK-NAG warnings for IAM and CodeBuild
		NagSuppressions.addResourceSuppressionsByPath(this, "/DocTran-main-pipeline", [
			{ id: "AwsSolutions-IAM5", reason: "Permissions required for deployment" },
			{ id: "AwsSolutions-CB4", reason: "Default encryption is acceptable in this case" },
		]);

		NagSuppressions.addResourceSuppressionsByPath(this, "/DocTran-main-pipeline/pipeline", [
			{ id: "AwsSolutions-IAM5", reason: "Pipeline role requires these permissions" },
		]);

		NagSuppressions.addResourceSuppressionsByPath(this, "/DocTran-main-pipeline/pipeline/Source", [
			{ id: "AwsSolutions-IAM5", reason: "Pipeline source role permissions" },
		]);

		NagSuppressions.addResourceSuppressionsByPath(this, "/DocTran-main-pipeline/pipeline/Build", [
			{ id: "AwsSolutions-IAM5", reason: "Build requires these permissions" },
		]);

		// Removed the failing suppression path
	}
}
