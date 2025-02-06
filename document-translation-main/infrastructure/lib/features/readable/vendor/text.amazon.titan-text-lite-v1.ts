import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { aws_lambda as lambda, aws_stepfunctions as sfn, aws_stepfunctions_tasks as tasks } from "aws-cdk-lib";

export interface props {
    invokeBedrockLambda: lambda.Function;
    removalPolicy: cdk.RemovalPolicy;
}

export class dt_readableWorkflow extends Construct {
    public readonly modelChoiceCondition: sfn.Condition;
    public readonly invokeModel: sfn.Chain;

    constructor(scope: Construct, id: string, props: props) {
        super(scope, id);
        
        this.modelChoiceCondition = sfn.Condition.stringEquals('$.jobDetails.modelId', 'amazon.titan-text-lite-v1');
        
        const invokeModelState = new tasks.LambdaInvoke(this, 'InvokeModel_AmazonTitanText', {
            lambdaFunction: props.invokeBedrockLambda,
            resultPath: '$.invokeResult',
            payload: sfn.TaskInput.fromObject({
                modelId: sfn.JsonPath.stringAt('$.jobDetails.modelId'),
                input: sfn.JsonPath.stringAt('$.jobDetails.input')
            })
        });
        
        this.invokeModel = sfn.Chain.start(invokeModelState);
    }
}
