#!/bin/bash

# Set the AWS region
AWS_REGION="eu-west-2"

# Common parameters
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/common/instance/name" --value "main" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/common/development/enable" --value "true" --type "String" --overwrite

# Pipeline parameters
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/repoOwner" --value "Ed2783" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/repoName" --value "Simply_Readable_Project" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/repoBranch" --value "main" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/repoHookEnable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/repoPeriodicChecksEnable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/source/connectionArn" --value "arn:aws:codeconnections:eu-west-2:084828583135:connection/c9553e41-5e8e-45c2-b1a1-bec2cf4a6169" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/approvals/preCdkSynth/enable" --value "false" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/pipeline/removalPolicy" --value "DELETE" --type "String" --overwrite

# App parameters
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/cognito/localUsers/enable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/cognito/localUsers/mfa/enforcement" --value "OFF" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/cognito/localUsers/mfa/otp" --value "false" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/cognito/localUsers/mfa/sms" --value "false" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/cognito/saml/enable" --value "false" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/webUi/enable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/webUi/customDomain/enable" --value "false" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/translation/enable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/translation/lifecycle" --value "7" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/translation/pii/enable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/translation/pii/lifecycle" --value "7" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/readable/enable" --value "true" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/readable/bedrockRegion" --value "eu-west-2" --type "String" --overwrite
aws ssm put-parameter --region $AWS_REGION --name "doctran/main/app/removalPolicy" --value "DELETE" --type "String" --overwrite

echo "All parameters have been created successfully!" 