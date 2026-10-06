import { describe, expect, it, vi } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { AgroGps } from '../nodes/AgroGps/AgroGps.node';
import { AgroGpsTrigger } from '../nodes/AgroGpsTrigger/AgroGpsTrigger.node';
import { sign } from '../nodes/AgroGpsTrigger/signature';
import { AgroGpsApi } from '../credentials/AgroGpsApi.credentials';
import { failure, farms, ok, sherpa } from './fixtures.mjs';

const node = { id: '1', name: 'Agro GPS', type: 'n8n-nodes-agro-gps.agroGps', typeVersion: 1, position: [0, 0], parameters: {} };

function context({ items = [{ json: {} }], parameters, authenticated = [], anonymous = [], continueOnFail = false }) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of authenticated) {
		if (response instanceof Error) httpRequestWithAuthentication.mockRejectedValueOnce(response);
		else httpRequestWithAuthentication.mockResolvedValueOnce(response);
	}
	const httpRequest = vi.fn();
	for (const response of anonymous) httpRequest.mockResolvedValueOnce(response);
	return {
		getInputData: () => items,
		getNodeParameter: (name, index, fallback) => {
			const values = parameters[index] ?? parameters[0];
			return name in values ? values[name] : fallback;
		},
		getNode: () => node,
		continueOnFail: () => continueOnFail,
		helpers: { httpRequestWithAuthentication, httpRequest },
	};
}

describe('AgroGps node', () => {
	it('describes four resources and only asks for a key outside product lookups', () => {
		const { description } = new AgroGps();
		expect(description.name).toBe('agroGps');
		expect(description.usableAsTool).toBe(true);
		const resource = description.properties.find((p) => p.name === 'resource');
		expect(resource.options.map((o) => o.value)).toEqual(['farm', 'field', 'operation', 'product']);
		expect(description.credentials[0].displayOptions.show.resource).toEqual(['farm', 'field', 'operation']);
	});

	it('looks up a product anonymously and pairs the items', async () => {
		const ctx = context({ items: [{ json: {} }, { json: {} }], parameters: [{ resource: 'product', operation: 'get', registrationNumber: '25421', country: 'ES', splitUses: false }], anonymous: [ok(sherpa), ok(sherpa)] });
		const [output] = await new AgroGps().execute.call(ctx);
		expect(output).toHaveLength(2);
		expect(output[1].pairedItem).toEqual({ item: 1 });
		expect(ctx.helpers.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('lists farms with the credential', async () => {
		const ctx = context({ parameters: [{ resource: 'farm', operation: 'getAll' }], authenticated: [ok(farms)] });
		const [output] = await new AgroGps().execute.call(ctx);
		expect(output[0].json.name).toBe('Finca Los Llanos');
		expect(ctx.helpers.httpRequestWithAuthentication).toHaveBeenCalledWith('agroGpsApi', expect.objectContaining({ url: 'https://api.agrogps.eu/api/v1/farms' }));
	});

	it('generates a UUID for a registered operation', async () => {
		const ctx = context({
			parameters: [{ resource: 'operation', operation: 'register', fieldReference: 'X1', operationType: 'observation', title: 'Plaga', date: '2026-10-01', country: 'ES' }],
			authenticated: [ok({ farm_id: farms[0].id, results: [{ id: 'gen', result: 'accepted' }] })],
		});
		await new AgroGps().execute.call(ctx);
		const sent = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body.entries[0];
		expect(sent.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it('turns API errors into NodeApiError and input errors into NodeOperationError', async () => {
		const apiCtx = context({ parameters: [{ resource: 'farm', operation: 'getAll' }], authenticated: [failure(401, { code: 'AUT_003' })] });
		const apiError = await new AgroGps().execute.call(apiCtx).catch((e) => e);
		expect(apiError).toBeInstanceOf(NodeApiError);
		expect(apiError.message).toBe('Invalid or missing API key');
		const inputCtx = context({ parameters: [{ resource: 'product', operation: 'search', productName: 'ab', country: 'ES' }] });
		const inputError = await new AgroGps().execute.call(inputCtx).catch((e) => e);
		expect(inputError).toBeInstanceOf(NodeOperationError);
	});

	it('wraps transport failures and passes node errors through', async () => {
		const failing = context({ parameters: [{ resource: 'farm', operation: 'getAll' }], authenticated: [new Error('socket hang up')] });
		await expect(new AgroGps().execute.call(failing)).rejects.toBeInstanceOf(NodeApiError);
		const original = new NodeOperationError(node, 'wrapped');
		const passing = context({ parameters: [{ resource: 'farm', operation: 'getAll' }], authenticated: [original] });
		await expect(new AgroGps().execute.call(passing)).rejects.toBe(original);
	});

	it('continues on fail with the error description', async () => {
		const ctx = context({ parameters: [{ resource: 'farm', operation: 'getAll' }], authenticated: [failure(403, { code: 'AUT_004' })], continueOnFail: true });
		const [output] = await new AgroGps().execute.call(ctx);
		expect(output[0].json.error).toBe('This API key is read-only');
		const plain = context({ parameters: [{ resource: 'farm', operation: 'nope' }], continueOnFail: true });
		const [plainOutput] = await new AgroGps().execute.call(plain);
		expect(plainOutput[0].json).toEqual({ error: 'Unsupported operation: farm / nope', description: '' });
	});
});

describe('AgroGpsApi credential', () => {
	it('sends the key as X-API-Key and tests against the farms list', () => {
		const credential = new AgroGpsApi();
		expect(credential.authenticate.properties.headers['X-API-Key']).toBe('={{$credentials.apiKey}}');
		expect(credential.test.request.url).toBe('/api/v1/farms');
	});
});

function hookContext({ staticData = {}, responses = [], events = ['entry.pushed'] }) {
	const httpRequestWithAuthentication = vi.fn();
	for (const response of responses) {
		if (response instanceof Error) httpRequestWithAuthentication.mockRejectedValueOnce(response);
		else httpRequestWithAuthentication.mockResolvedValueOnce(response);
	}
	return {
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/x/webhook',
		getNodeParameter: (name, fallback) => (name === 'events' ? events : fallback),
		getNode: () => node,
		helpers: { httpRequestWithAuthentication },
	};
}

describe('AgroGpsTrigger lifecycle', () => {
	const methods = new AgroGpsTrigger().webhookMethods.default;

	it('creates, checks and deletes the webhook in Agro GPS', async () => {
		const staticData = {};
		const created = hookContext({ staticData, responses: [{ statusCode: 201, body: { data: { id: 'h-1', secret: 's-1' } } }] });
		await expect(methods.create.call(created)).resolves.toBe(true);
		expect(staticData).toEqual({ webhookId: 'h-1', secret: 's-1' });
		const listed = hookContext({ staticData, responses: [{ statusCode: 200, body: { data: { webhooks: [{ id: 'h-1', url: 'https://n8n.example.com/webhook/x/webhook', active: true }] } } }] });
		await expect(methods.checkExists.call(listed)).resolves.toBe(true);
		const removed = hookContext({ staticData, responses: [{ statusCode: 200, body: {} }] });
		await expect(methods.delete.call(removed)).resolves.toBe(true);
		expect(staticData).toEqual({});
	});

	it('forgets a webhook that no longer exists and defaults empty events', async () => {
		const staticData = { webhookId: 'gone', secret: 's' };
		const listed = hookContext({ staticData, responses: [{ statusCode: 200, body: { data: { webhooks: [] } } }] });
		await expect(methods.checkExists.call(listed)).resolves.toBe(false);
		expect(staticData).toEqual({});
		const created = hookContext({ staticData, events: [], responses: [{ statusCode: 201, body: { data: { id: 'h', secret: 's' } } }] });
		await methods.create.call(created);
		expect(created.helpers.httpRequestWithAuthentication.mock.calls[0][1].body.events).toEqual(['entry.pushed', 'entry.reviewed']);
	});

	it('wraps registry failures in NodeApiError', async () => {
		const fail = { statusCode: 403, body: { message: 'solo lectura' } };
		await expect(methods.create.call(hookContext({ responses: [fail] }))).rejects.toBeInstanceOf(NodeApiError);
		await expect(methods.checkExists.call(hookContext({ staticData: { webhookId: 'h' }, responses: [fail] }))).rejects.toBeInstanceOf(NodeApiError);
		await expect(methods.delete.call(hookContext({ staticData: { webhookId: 'h' }, responses: [{ statusCode: 500, body: {} }] }))).rejects.toBeInstanceOf(NodeApiError);
	});
});

function deliveryContext({ secret = 's-1', headers, body, events = ['entry.pushed'] }) {
	const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
	return {
		response,
		ctx: {
			getRequestObject: () => ({ headers, rawBody: Buffer.from(JSON.stringify(body)) }),
			getResponseObject: () => response,
			getBodyData: () => body,
			getWorkflowStaticData: () => ({ secret }),
			getNodeParameter: (name, fallback) => (name === 'events' ? events : fallback),
			helpers: { returnJsonArray: (items) => items.map((json) => ({ json })) },
		},
	};
}

describe('AgroGpsTrigger delivery', () => {
	const body = { event: 'entry.pushed', farm_id: 'f', data: { accepted: 1 } };
	const now = String(Math.floor(Date.now() / 1000));
	const signed = { 'x-agro-timestamp': now, 'x-agro-signature': sign('s-1', now, Buffer.from(JSON.stringify(body))), 'x-agro-event': 'entry.pushed' };

	it('starts the workflow on a valid signed delivery', async () => {
		const { ctx } = deliveryContext({ headers: signed, body });
		const result = await new AgroGpsTrigger().webhook.call(ctx);
		expect(result.workflowData[0][0].json).toMatchObject({ event: 'entry.pushed', farm_id: 'f' });
	});

	it('answers 401 to a forged delivery', async () => {
		const { ctx, response } = deliveryContext({ headers: { ...signed, 'x-agro-signature': 'sha256=bad' }, body });
		const result = await new AgroGpsTrigger().webhook.call(ctx);
		expect(result).toEqual({ noWebhookResponse: true });
		expect(response.status).toHaveBeenCalledWith(401);
	});

	it('acknowledges events the workflow does not want', async () => {
		const { ctx } = deliveryContext({ headers: signed, body, events: ['entry.reviewed'] });
		await expect(new AgroGpsTrigger().webhook.call(ctx)).resolves.toEqual({ webhookResponse: { ignored: 'entry.pushed' } });
		const noEventHeader = deliveryContext({ headers: { ...signed, 'x-agro-event': undefined }, body, events: ['entry.reviewed'] });
		await expect(new AgroGpsTrigger().webhook.call(noEventHeader.ctx)).resolves.toEqual({ webhookResponse: { ignored: 'entry.pushed' } });
		const noSecret = deliveryContext({ secret: '', headers: signed, body });
		expect((await new AgroGpsTrigger().webhook.call(noSecret.ctx)).noWebhookResponse).toBe(true);
	});

	it('falls back to an empty event when neither header nor body has one', async () => {
		const bare = { farm_id: 'f' };
		const headers = { 'x-agro-timestamp': now, 'x-agro-signature': sign('s-1', now, Buffer.from(JSON.stringify(bare))) };
		const { ctx } = deliveryContext({ headers, body: bare, events: ['entry.pushed'] });
		await expect(new AgroGpsTrigger().webhook.call(ctx)).resolves.toEqual({ webhookResponse: { ignored: '' } });
	});
});
