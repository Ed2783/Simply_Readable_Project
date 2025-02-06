import * as mammoth from 'mammoth';
import { S3 } from '@aws-sdk/client-s3';

interface Event {
	key: string;
}

interface MammothOptions {
	styleMap: string[];
}

const s3 = new S3({});

export const handler = async (
	event: Event
): Promise<String> => {
	console.log('Received event:', JSON.stringify(event, null, 4));

	const bucket = process.env.BUCKET_NAME;
	const key = event.key;
	
	let file;
	try {
		// Get the file from S3
		file = await s3.getObject({ 
			Bucket: bucket, 
			Key: key 
		});
	} catch (error) {
		console.error('Error getting file from S3:', error);
		throw error;
	}

	const options: MammothOptions = {
		styleMap: [
			"p[style-name='Title'] => h1:fresh",
			"p[style-name='Subtitle'] => h2:fresh"
		]
	};

	let result;
	try {
		// Convert DOCX to HTML
		result = await mammoth.convertToHtml(
			{ buffer: await file.Body?.transformToByteArray() },
			options
		);
		console.log("Messages:", result.messages)

	} catch (error) {
		console.error('Error converting DOCX to HTML:', error);
		throw error;
	}

	return result.value;
};
