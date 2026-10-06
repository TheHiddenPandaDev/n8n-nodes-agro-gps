import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

export const WEBHOOKS_URL = 'https://api.agrogps.eu/api/v1/webhooks';

export interface RegistryResponse {
	statusCode: number;
	body: unknown;
}

export type RegistryTransport = (options: IHttpRequestOptions) => Promise<RegistryResponse>;

export interface StoredWebhook {
	webhookId?: string;
	secret?: string;
}

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const HTTP_NOT_FOUND = 404;

function request(method: 'GET' | 'POST' | 'DELETE', url: string, body?: IDataObject): IHttpRequestOptions {
	const options: IHttpRequestOptions = {
		method,
		url,
		headers: { Accept: 'application/json' },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body) options.body = body;
	return options;
}

function data(body: unknown): IDataObject {
	const envelope = body && typeof body === 'object' ? (body as IDataObject) : {};
	const inner = envelope.data;
	return inner && typeof inner === 'object' && !Array.isArray(inner) ? (inner as IDataObject) : {};
}

function ok(status: number): boolean {
	return status >= HTTP_OK_MIN && status <= HTTP_OK_MAX;
}

function failure(action: string, response: RegistryResponse): Error {
	const body = response.body && typeof response.body === 'object' ? (response.body as IDataObject) : {};
	const detail = typeof body.message === 'string' ? `: ${body.message}` : '';
	return new Error(`Agro GPS could not ${action} the webhook (HTTP ${response.statusCode})${detail}`);
}

export async function webhookExists(
	transport: RegistryTransport,
	stored: StoredWebhook,
	url: string,
): Promise<boolean> {
	if (!stored.webhookId) return false;
	const response = await transport(request('GET', WEBHOOKS_URL));
	if (!ok(response.statusCode)) throw failure('list', response);
	const hooks = Array.isArray(data(response.body).webhooks) ? (data(response.body).webhooks as IDataObject[]) : [];
	return hooks.some((hook) => hook.id === stored.webhookId && hook.url === url && hook.active !== false);
}

export async function createWebhook(
	transport: RegistryTransport,
	url: string,
	events: string[],
): Promise<StoredWebhook> {
	const response = await transport(request('POST', WEBHOOKS_URL, { url, events }));
	if (!ok(response.statusCode)) throw failure('create', response);
	const hook = data(response.body);
	if (typeof hook.id !== 'string' || typeof hook.secret !== 'string') {
		throw new Error('Agro GPS created the webhook but did not return its id and secret');
	}
	return { webhookId: hook.id, secret: hook.secret };
}

export async function deleteWebhook(transport: RegistryTransport, stored: StoredWebhook): Promise<boolean> {
	if (!stored.webhookId) return true;
	const response = await transport(request('DELETE', `${WEBHOOKS_URL}/${encodeURIComponent(stored.webhookId)}`));
	if (ok(response.statusCode) || response.statusCode === HTTP_NOT_FOUND) return true;
	throw failure('delete', response);
}
