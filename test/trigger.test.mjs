import { describe, expect, it, vi } from 'vitest';
import { headerValue, rawBodyOf, sign, verifySignature, wantsEvent } from '../nodes/AgroGpsTrigger/signature';
import { createWebhook, deleteWebhook, webhookExists, WEBHOOKS_URL } from '../nodes/AgroGpsTrigger/webhook-registry';

const SECRET = 'whsec_test';
const BODY = Buffer.from('{"event":"entry.pushed","farm_id":"f"}');

describe('signature', () => {
	it('matches the Go server format sha256=hex(hmac(ts + "." + body))', () => {
		expect(sign(SECRET, '1700000000', BODY)).toMatch(/^sha256=[0-9a-f]{64}$/);
	});

	it('accepts a fresh valid signature', () => {
		const signature = sign(SECRET, '1000', BODY);
		expect(verifySignature(SECRET, '1000', signature, BODY, 1100, 300)).toBe('valid');
		expect(verifySignature(SECRET, '1000', signature, BODY, 99999, 0)).toBe('valid');
	});

	it('rejects missing, stale and forged deliveries', () => {
		const signature = sign(SECRET, '1000', BODY);
		expect(verifySignature('', '1000', signature, BODY, 1000, 300)).toBe('missing');
		expect(verifySignature(SECRET, '', signature, BODY, 1000, 300)).toBe('missing');
		expect(verifySignature(SECRET, 'abc', signature, BODY, 1000, 300)).toBe('missing');
		expect(verifySignature(SECRET, '1000', signature, BODY, 2000, 300)).toBe('stale');
		expect(verifySignature(SECRET, '1000', 'sha256=short', BODY, 1000, 300)).toBe('mismatch');
		expect(verifySignature('other', '1000', signature, BODY, 1000, 300)).toBe('mismatch');
	});

	it('filters events and reads headers and raw bodies', () => {
		expect(wantsEvent([], 'x')).toBe(true);
		expect(wantsEvent(['*'], 'x')).toBe(true);
		expect(wantsEvent(['entry.pushed'], 'entry.reviewed')).toBe(false);
		expect(headerValue(['a', 'b'])).toBe('a');
		expect(headerValue([1])).toBe('');
		expect(headerValue(undefined)).toBe('');
		expect(rawBodyOf(BODY, {})).toBe(BODY);
		expect(rawBodyOf('{"a":1}', {}).toString()).toBe('{"a":1}');
		expect(rawBodyOf(undefined, { a: 1 }).toString()).toBe('{"a":1}');
		expect(rawBodyOf(undefined, undefined).toString()).toBe('{}');
	});
});

describe('webhook registry', () => {
	const URL = 'https://n8n.example.com/webhook/abc/webhook';

	it('creates the webhook and keeps id and secret', async () => {
		const transport = vi.fn().mockResolvedValue({ statusCode: 201, body: { data: { id: 'h-1', secret: 's-1' } } });
		await expect(createWebhook(transport, URL, ['entry.pushed'])).resolves.toEqual({ webhookId: 'h-1', secret: 's-1' });
		expect(transport.mock.calls[0][0]).toMatchObject({ method: 'POST', url: WEBHOOKS_URL, body: { url: URL, events: ['entry.pushed'] } });
	});

	it('explains failed or incomplete creations', async () => {
		const forbidden = vi.fn().mockResolvedValue({ statusCode: 403, body: { code: 'AUT_004', message: 'solo lectura' } });
		await expect(createWebhook(forbidden, URL, [])).rejects.toThrow('could not create the webhook (HTTP 403): solo lectura');
		const empty = vi.fn().mockResolvedValue({ statusCode: 201, body: { data: { id: 'h-1' } } });
		await expect(createWebhook(empty, URL, [])).rejects.toThrow('did not return its id and secret');
		const plain = vi.fn().mockResolvedValue({ statusCode: 500, body: 'oops' });
		await expect(createWebhook(plain, URL, [])).rejects.toThrow('(HTTP 500)');
	});

	it('checks existence by id, url and active flag', async () => {
		const list = { statusCode: 200, body: { data: { webhooks: [{ id: 'h-1', url: URL, active: true }, { id: 'h-2', url: URL, active: false }] } } };
		const transport = vi.fn().mockResolvedValue(list);
		await expect(webhookExists(transport, {}, URL)).resolves.toBe(false);
		expect(transport).not.toHaveBeenCalled();
		await expect(webhookExists(transport, { webhookId: 'h-1' }, URL)).resolves.toBe(true);
		await expect(webhookExists(transport, { webhookId: 'h-2' }, URL)).resolves.toBe(false);
		await expect(webhookExists(transport, { webhookId: 'h-1' }, 'https://other')).resolves.toBe(false);
		const odd = vi.fn().mockResolvedValue({ statusCode: 200, body: { data: [] } });
		await expect(webhookExists(odd, { webhookId: 'h-1' }, URL)).resolves.toBe(false);
		const broken = vi.fn().mockResolvedValue({ statusCode: 500, body: {} });
		await expect(webhookExists(broken, { webhookId: 'h-1' }, URL)).rejects.toThrow('could not list');
	});

	it('deletes, tolerating a webhook already gone', async () => {
		await expect(deleteWebhook(vi.fn(), {})).resolves.toBe(true);
		const gone = vi.fn().mockResolvedValue({ statusCode: 404, body: {} });
		await expect(deleteWebhook(gone, { webhookId: 'h/1' })).resolves.toBe(true);
		expect(gone.mock.calls[0][0]).toMatchObject({ method: 'DELETE', url: `${WEBHOOKS_URL}/h%2F1` });
		const fails = vi.fn().mockResolvedValue({ statusCode: 500, body: {} });
		await expect(deleteWebhook(fails, { webhookId: 'h-1' })).rejects.toThrow('could not delete');
	});
});
