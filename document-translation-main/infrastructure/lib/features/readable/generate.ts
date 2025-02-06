// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";

import {
	aws_iam as iam,
	aws_stepfunctions as sfn,
	aws_s3 as s3,
} from "aws-cdk-lib";

import * as dt_enums from "./enum";
import { dt_stepfunction } from "../../components/stepfunction";
import { dt_lambda } from "../../components/lambda";

import { dt_readableWorkflow as dt_readableWorkflow_amazon_titanImage } from "./vendor/image.amazon.titan-image-generator-v1";
import { dt_readableWorkflow as dt_readableWorkflow_amazon_titanText } from "./vendor/text.amazon.titan-text-lite-v1";
import { dt_readableWorkflow as dt_readableWorkflow_anthropic_claudeText } from "./vendor/text.anthropic.claude-v2";
import { dt_readableWorkflow as dt_readableWorkflow_anthropic_claude3Text } from "./vendor/text.anthropic.claude-3-sonnet-v1";
import { dt_readableWorkflow as dt_readableWorkflow_stabilityai_stableDiffusion } from "./vendor/image.stability.stable-diffusion-xl-v1";

export interface props {
	bedrockRegion: string;
	contentBucket: s3.Bucket;
	removalPolicy: cdk.RemovalPolicy;
}

export class dt_readableWorkflowGenerate extends Construct {
	public readonly sfnMain: sfn.StateMachine;

	constructor(scope: Construct, id: string, props: props) {
		super(scope, id);

		// LAMBDA
		// LAMBDA | INVOKE BEDROCK
		// LAMBDA | INVOKE BEDROCK | ROLE
		const invokeBedrockLambdaRole = new iam.Role(
			this,
			"invokeBedrockLambdaRole",
			{
				// ASM-L6 // ASM-L8
				assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
				description: "Lambda Role (Invoke Bedrock API)",
			},
		);

		// LAMBDA | INVOKE BEDROCK | POLICY
		const permitInvokeBedrockModel = new iam.Policy(
			this,
			"permitSfnSendSuccess",
			{
				policyName: "Send-Sfn-task-success-to-Sfn-Service",
				statements: [
					new iam.PolicyStatement({
						// ASM-IAM
						actions: ["bedrock:InvokeModel"],
						resources: [
							`arn:aws:bedrock:${props.bedrockRegion}::foundation-model/*`, // Foundational Models
							`arn:aws:bedrock:${props.bedrockRegion}:${
								cdk.Stack.of(this).account
							}:custom-model/*`,
						],
					}),
				],
			},
		);
		invokeBedrockLambdaRole.attachInlinePolicy(permitInvokeBedrockModel);
		NagSuppressions.addResourceSuppressions(
			permitInvokeBedrockModel,
			[
				{
					id: "AwsSolutions-IAM5",
					reason: "Preferred model for prompt is unknown at deploy time",
					appliesTo: [
						`Resource::arn:aws:bedrock:${props.bedrockRegion}::foundation-model/*`,
					],
				},
				{
					id: "AwsSolutions-IAM5",
					reason: "User provided model for prompt is unknown at deploy time",
					appliesTo: [
						`Resource::arn:aws:bedrock:${props.bedrockRegion}:<AWS::AccountId>:custom-model/*`,
					],
				},
			],
			true,
		);

		// LAMBDA | INVOKE BEDROCK | FUNCTION
		const invokeBedrockLambda = new dt_lambda(this, "invokeBedrockLambda", {
			role: invokeBedrockLambdaRole,
			path: "lambda/invokeBedrock",
			description: "Invoke Bedrock API",
			environment: {
				BEDROCK_REGION: props.bedrockRegion,
			},
			bundlingNodeModules: ["@aws-sdk/client-bedrock-runtime"],
			timeout: cdk.Duration.seconds(60),
		});

		//
		// MODEL WORKFLOWS
		// MODEL WORKFLOWS | CHOICE
		const modelChoice = new sfn.Choice(this, "ModelChoiceState");
		// MODEL CHOICE | UNRECOGNISED
		const failUnrecognisedModel = new sfn.Fail(this, "FailUnrecognisedModelState", {
			error: dt_enums.ItemStatus.FAILED_UNRECOGNISEDMODEL,
			causePath: sfn.JsonPath.format(
				"Workflow does not recognise modelId of '{}'",
				sfn.JsonPath.stringAt("$.jobDetails.modelId"),
			),
		});

		// MODEL WORKFLOWS | TEXT | AMAZON
		const workflow_amazon_text = new dt_readableWorkflow_amazon_titanText(
			this,
			`${cdk.Stack.of(this).stackName}_ReadableGenerate_AmazonTitanText`,
			{
				invokeBedrockLambda: invokeBedrockLambda.lambdaFunction,
				removalPolicy: props.removalPolicy,
			},
		);
		// MODEL WORKFLOWS | IMAGE | AMAZON
		const workflow_amazon_image = new dt_readableWorkflow_amazon_titanImage(
			this,
			`${cdk.Stack.of(this).stackName}_ReadableGenerate_AmazonTitanImage`,
			{
				invokeBedrockLambda: invokeBedrockLambda.lambdaFunction,
				removalPolicy: props.removalPolicy,
			},
		);
		// MODEL WORKFLOWS | TEXT | ANTHRHOPIC
		// MODEL WORKFLOWS | TEXT | ANTHRHOPIC | CLAUDE v2
		const workflow_anthropic = new dt_readableWorkflow_anthropic_claudeText(
			this,
			`${cdk.Stack.of(this).stackName}_ReadableGenerate_AnthropicClaude`,
			{
				invokeBedrockLambda: invokeBedrockLambda.lambdaFunction,
				removalPolicy: props.removalPolicy,
			},
		);
		// MODEL WORKFLOWS | TEXT | ANTHRHOPIC | CLAUDE 3 SONNET HAIKU
		const workflow_anthropic3 = new dt_readableWorkflow_anthropic_claude3Text(
			this,
			`${cdk.Stack.of(this).stackName}_ReadableGenerate_AnthropicClaude3`,
			{
				invokeBedrockLambda: invokeBedrockLambda.lambdaFunction,
				removalPolicy: props.removalPolicy,
			},
		);
		// MODEL WORKFLOWS | IMAGE | STABILITYAI
		const workflow_stabilityai =
			new dt_readableWorkflow_stabilityai_stableDiffusion(
				this,
				`${cdk.Stack.of(this).stackName}_ReadableGenerate_StabilityAI`,
				{
					invokeBedrockLambda: invokeBedrockLambda.lambdaFunction,
					removalPolicy: props.removalPolicy,
				},
			);

		//
		// STATE MACHINE
		// STATE MACHINE | DEF
		const definition = modelChoice
			.when(
				workflow_amazon_text.modelChoiceCondition,
				workflow_amazon_text.invokeModel.startState
			)
			.when(
				workflow_amazon_image.modelChoiceCondition,
				workflow_amazon_image.invokeModel.startState
			)
			.when(
				workflow_anthropic.modelChoiceCondition,
				workflow_anthropic.invokeModel.startState
			)
			.when(
				workflow_anthropic3.modelChoiceCondition,
				workflow_anthropic3.invokeModel.startState
			)
			.when(
				workflow_stabilityai.modelChoiceCondition,
				workflow_stabilityai.invokeModel.startState
			)
			.otherwise(failUnrecognisedModel);

		this.sfnMain = new dt_stepfunction(
			this,
			`${cdk.Stack.of(this).stackName}_ReadableGenerate`,
			{
				nameSuffix: "ReadableGenerate",
				removalPolicy: props.removalPolicy,
				definition: definition,
			},
		).StateMachine;

		NagSuppressions.addResourceSuppressions(
			this.sfnMain,
			[
				{
					id: "AwsSolutions-IAM5",
					reason:
						"Permission scoped to project specific resources. Execution ID unknown at deploy time.",
					appliesTo: [
						`Resource::arn:<AWS::Partition>:states:<AWS::Region>:<AWS::AccountId>:execution:${cdk.Stack.of(this).stackName}_ReadableGenerate_AmazonTitanText*`,
						`Resource::arn:<AWS::Partition>:states:<AWS::Region>:<AWS::AccountId>:execution:${cdk.Stack.of(this).stackName}_ReadableGenerate_AmazonTitanImage*`,
						`Resource::arn:<AWS::Partition>:states:<AWS::Region>:<AWS::AccountId>:execution:${cdk.Stack.of(this).stackName}_ReadableGenerate_AnthropicClaude*`,
						`Resource::arn:<AWS::Partition>:states:<AWS::Region>:<AWS::AccountId>:execution:${cdk.Stack.of(this).stackName}_ReadableGenerate_AnthropicClaude3*`,
						`Resource::arn:<AWS::Partition>:states:<AWS::Region>:<AWS::AccountId>:execution:${cdk.Stack.of(this).stackName}_ReadableGenerate_StabilityAI*`,
					],
				},
			],
			true,
		);
		// END
	}
}
