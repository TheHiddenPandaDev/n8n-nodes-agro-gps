import type { IDataObject } from 'n8n-workflow';

export interface ApiErrorDescription {
	httpCode: string;
	code?: string;
	message: string;
	description: string;
}

const KEYS_URL = 'https://agrogps.eu/app/';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

const READ_ONLY_KEY = 'AUT_004';
const KEY_ROUTE_FORBIDDEN = 'AUT_005';
const DAILY_LIMIT = 'KEY_430';
const REGISTER_NOT_MIRRORED = 'FIT_405';

function asObject(value: unknown): IDataObject {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as IDataObject) : {};
}

function serverMessage(body: IDataObject): string {
	return typeof body.message === 'string' ? body.message : '';
}

function withServerMessage(text: string, body: IDataObject): string {
	const detail = serverMessage(body);
	return detail ? `${text} API message: ${detail}` : text;
}

function retryText(seconds?: number): string {
	return seconds ? ` Retry after ${seconds} seconds.` : '';
}

export function describeApiError(
	status: number,
	rawBody: unknown,
	retryAfterSeconds?: number,
): ApiErrorDescription {
	const body = asObject(rawBody);
	const code = typeof body.code === 'string' ? body.code : undefined;
	const base = { httpCode: String(status), code };

	if (code === READ_ONLY_KEY) {
		return {
			...base,
			message: 'This API key is read-only',
			description: `Create a write key in the Agro GPS app (Settings > API and webhooks) to register operations or create fields. ${KEYS_URL}`,
		};
	}
	if (code === KEY_ROUTE_FORBIDDEN) {
		return {
			...base,
			message: 'An API key cannot do this',
			description: withServerMessage('API keys can read data, register new operations and create fields.', body),
		};
	}
	if (code === DAILY_LIMIT) {
		return {
			...base,
			message: 'Daily API quota exhausted',
			description: withServerMessage(`This key has no requests left today.${retryText(retryAfterSeconds)}`, body),
		};
	}
	if (code === REGISTER_NOT_MIRRORED) {
		return {
			...base,
			message: 'This country register is not available yet',
			description: withServerMessage('Agro GPS does not mirror the plant protection register of that country yet.', body),
		};
	}
	if (status === HTTP_TOO_MANY) {
		return {
			...base,
			message: 'Too many requests',
			description: `The rate limit was reached.${retryText(retryAfterSeconds)} You can enable Retry On Fail in the node settings.`,
		};
	}
	if (status === HTTP_UNAUTHORIZED) {
		return {
			...base,
			message: 'Invalid or missing API key',
			description: withServerMessage(
				`Check the key in the Agro GPS API credential. Keys are created in the app under Settings > API and webhooks. ${KEYS_URL}`,
				body,
			),
		};
	}
	if (status === HTTP_FORBIDDEN) {
		return {
			...base,
			message: 'Not allowed on this farm',
			description: withServerMessage('Your role on this farm does not allow this action.', body),
		};
	}
	if (status === HTTP_NOT_FOUND) {
		return {
			...base,
			message: 'Not found',
			description: withServerMessage('Check the registration number, country or farm.', body),
		};
	}
	if (status === HTTP_BAD_REQUEST || status === HTTP_UNPROCESSABLE) {
		return {
			...base,
			message: 'The request was rejected',
			description: withServerMessage('Check the fields of this item.', body),
		};
	}
	if (status >= HTTP_SERVER_ERROR) {
		return {
			...base,
			message: 'Agro GPS server error',
			description: withServerMessage(`Try again in a few minutes.${retryText(retryAfterSeconds)}`, body),
		};
	}
	return {
		...base,
		message: `Unexpected response (HTTP ${status})`,
		description: withServerMessage('The API answered with an unexpected status.', body),
	};
}
