import { NodeApiError, type FunctionsBase } from 'n8n-workflow';

export async function parseCredentials(fns: FunctionsBase) {
	const credentials = await fns.getCredentials<
		(
			| {
					type: 'cookies';
					cookies: string;
			  }
			| {
					type: 'key';
					key: string;
			  }
		) & {
			url: string;
		}
	>('pelicanApi');

	const headers: HeadersInit = {
		accept: 'application/json',
	};
	switch (credentials.type) {
		case 'cookies':
			headers.cookies = credentials.cookies;
			break;
		case 'key':
			headers.authorization = 'Bearer ' + credentials.key;
			break;
		default:
			throw new NodeApiError(fns.getNode(), {}, { message: 'Unknown credential type' });
	}

	return {
		url: new URL(credentials.url),
		headers,
	};
}
