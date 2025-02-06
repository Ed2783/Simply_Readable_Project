// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { uploadData } from "@aws-amplify/storage";

import { configureS3Bucket } from "./configureS3Bucket";

interface Props {
	path: string;
	file: File;
	bucketKey: string;
}

export async function putObjectS3(props: Props) {
	try {
		configureS3Bucket(props.bucketKey);
		const result = await uploadData({
			path: props.path,
			data: props.file,
		}).result;
		console.log("putObjectS3 | result:", result);
	} catch (error) {
		console.log("Error uploading object:", error);
	}
}
