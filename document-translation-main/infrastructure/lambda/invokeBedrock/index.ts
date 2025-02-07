// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
	BedrockRuntimeClient,
	InvokeModelCommand,
	InvokeModelCommandInput,
	InvokeModelCommandOutput,
	ValidationException,
	ModelTimeoutException,
	ModelErrorException,
	ThrottlingException
} from "@aws-sdk/client-bedrock-runtime";

const BEDROCK_REGION: string | undefined =
	process.env.BEDROCK_REGION || undefined;

if (!BEDROCK_REGION) {
	throw new Error("Missing BEDROCK_REGION");
}

const bedrockClient: BedrockRuntimeClient = new BedrockRuntimeClient({
	region: BEDROCK_REGION,
});

interface event {
	modelId: string;
	input: any;
}

export const handler = async (event: event) => {
	console.log("Received event:", JSON.stringify(event, null, 4));

	const modelId: string = event.modelId;
	if (!modelId) {
		throw new Error("Missing modelId");
	}

	const input: any = event.input;
	if (!input) {
		throw new Error("Missing input");
	}

	try {
		const modelInput: InvokeModelCommandInput = {
			body: JSON.stringify(input),
			contentType: "application/json",
			accept: "application/json",
			modelId: modelId,
		};
		console.log("Bedrock API input:", JSON.stringify(modelInput, null, 4));
		
		const command = new InvokeModelCommand(modelInput);
		const response: InvokeModelCommandOutput = await bedrockClient.send(command);
		
		console.log("Bedrock API response metadata:", response.$metadata);
		const responseStatusCode = response.$metadata.httpStatusCode;
		
		if (responseStatusCode !== 200) {
			throw new Error(`Unexpected response status code: ${responseStatusCode}`);
		}

		const encodedResult = response.body;
		const stringResult = new TextDecoder().decode(encodedResult);
		const resultBody: any = JSON.parse(stringResult);

		return {
			body: resultBody,
			contentType: response.contentType,
		};
	} catch (error: unknown) {
		console.error("Error invoking Bedrock model:", error);
		
		if (error instanceof ValidationException) {
			throw new Error(`Invalid request: ${error.message}`);
		} else if (error instanceof ModelTimeoutException) {
			throw new Error(`Model timeout: ${error.message}`);
		} else if (error instanceof ModelErrorException) {
			throw new Error(`Model error: ${error.message}`);
		} else if (error instanceof ThrottlingException) {
			throw new Error(`Rate limit exceeded: ${error.message}`);
		} else if (error instanceof Error) {
			throw new Error(`Unexpected error: ${error.message}`);
		} else {
			throw new Error('An unknown error occurred');
		}
	}
};
