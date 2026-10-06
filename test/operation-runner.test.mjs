import { describe, expect, it, vi } from 'vitest';
import { AgroGpsApiError, runOperation, send } from '../nodes/AgroGps/shared/operation-runner';
import { AgroGpsInputError } from '../nodes/AgroGps/shared/input-error';
import { MAX_RECORD_PAGES } from '../nodes/AgroGps/shared/constants';
import { failure, farms, ok, recordsPage1, recordsPage2, sherpa } from './fixtures.mjs';

const FARM = farms[0].id;
const NEW_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function reader(values) {
	return (name) => (name in values ? values[name] : '');
}

function transportReturning(...responses) {
	const transport = vi.fn();
	for (const response of responses) transport.mockResolvedValueOnce(response);
	return transport;
}

function runtime(authenticated = vi.fn(), anonymous = vi.fn()) {
	return { authenticated, anonymous, newId: () => NEW_ID, now: () => new Date('2026-10-06T10:00:00Z') };
}

describe('send', () => {
	it('unwraps 2xx answers', async () => {
		await expect(send(transportReturning(ok({ a: 1 })), {})).resolves.toEqual({ a: 1 });
	});

	it('describes errors with Retry-After from either header form', async () => {
		const error = await send(transportReturning(failure(429, { code: 'KEY_429' }, { 'retry-after': ['9'] })), {}).catch((e) => e);
		expect(error).toBeInstanceOf(AgroGpsApiError);
		expect(error.details.description).toContain('Retry after 9 seconds');
		expect(error.body).toMatchObject({ code: 'KEY_429' });
		const plain = await send(transportReturning({ statusCode: 503, body: {}, headers: { 'Retry-After': 'soon' } }), {}).catch((e) => e);
		expect(plain.details.description).not.toContain('Retry after');
		const noHeaders = await send(transportReturning({ statusCode: 500, body: {} }), {}).catch((e) => e);
		expect(noHeaders.details.httpCode).toBe('500');
	});
});

describe('product operations', () => {
	it('gets a product without authentication', async () => {
		const anonymous = transportReturning(ok(sherpa));
		const items = await runOperation('product', 'get', reader({ registrationNumber: '25421', country: 'ES', splitUses: true }), runtime(vi.fn(), anonymous));
		expect(anonymous.mock.calls[0][0].url).toBe('https://api.agrogps.eu/api/public/phyto/25421');
		expect(items).toHaveLength(2);
	});

	it('searches products', async () => {
		const anonymous = transportReturning(ok({ matches: [{ name: 'KARATE ZEON' }] }));
		const items = await runOperation('product', 'search', reader({ productName: 'karate', country: 'FR' }), runtime(vi.fn(), anonymous));
		expect(items).toEqual([{ name: 'KARATE ZEON' }]);
	});
});

describe('farm and field operations', () => {
	it('lists farms', async () => {
		const items = await runOperation('farm', 'getAll', reader({}), runtime(transportReturning(ok(farms))));
		expect(items).toEqual([farms[0]]);
	});

	it('pages fields of the default farm and sorts them by name', async () => {
		const authenticated = transportReturning(ok(farms), ok(recordsPage1), ok(recordsPage2));
		const items = await runOperation('field', 'getAll', reader({ includeGeometry: true }), runtime(authenticated));
		expect(authenticated.mock.calls[2][0].qs).toEqual({ farm_id: FARM, since: 7 });
		expect(items.map((f) => f.name)).toEqual(['Almendros', 'Olivar']);
		expect(items[1].polygon).toHaveLength(3);
	});

	it('uses the given farm and stops when the cursor does not advance', async () => {
		const authenticated = transportReturning(ok({ ...recordsPage1, next: 0 }));
		const items = await runOperation('field', 'getAll', reader({ farmId: FARM }), runtime(authenticated));
		expect(authenticated).toHaveBeenCalledTimes(1);
		expect(items).toHaveLength(2);
	});

	it('fails when the key has no farm or the farm never ends', async () => {
		await expect(runOperation('field', 'getAll', reader({}), runtime(transportReturning(ok([]))))).rejects.toThrow('no farm yet');
		const endless = vi.fn(async (options) => ok({ records: [], next: options.qs.since + 1, has_more: true }));
		await expect(runOperation('field', 'getAll', reader({ farmId: FARM }), runtime(endless))).rejects.toThrow(
			`more than ${MAX_RECORD_PAGES} pages`,
		);
	});

	it('creates a field from a GeoJSON polygon', async () => {
		const authenticated = transportReturning(ok({ farm_id: FARM, fields: [{ id: 'DRAWN-1', name: 'Norte' }] }));
		const items = await runOperation(
			'field',
			'create',
			reader({ fieldName: 'Norte', country: '', cropCode: 'horvw', polygon: '{"type":"Polygon","coordinates":[[[2,1],[3,1],[3,2]]]}' }),
			runtime(authenticated),
		);
		expect(authenticated.mock.calls[0][0].body).toEqual({
			fields: [{ name: 'Norte', country: 'ES', crop_code: 'HORVW', polygon: [[1, 2], [1, 3], [2, 3]] }],
		});
		expect(items).toEqual([{ farm_id: FARM, id: 'DRAWN-1', name: 'Norte' }]);
	});
});

describe('operation register', () => {
	const values = {
		fieldReference: '45098A01300012',
		operationType: 'harvest',
		title: 'Cosecha',
		date: '2026-07-01T09:00:00',
		quantity: '4200',
		unit: 'kg',
		safetyDays: '',
		country: 'ES',
	};

	it('generates an id and returns the accepted result', async () => {
		const authenticated = transportReturning(ok({ farm_id: FARM, results: [{ id: NEW_ID, result: 'accepted' }] }));
		const items = await runOperation('operation', 'register', reader(values), runtime(authenticated));
		const sent = authenticated.mock.calls[0][0].body.entries[0];
		expect(sent).toMatchObject({ id: NEW_ID, entry_type: 'harvest', quantity: 4200, safety_days: 0 });
		expect(items).toEqual([{ farm_id: FARM, id: NEW_ID, result: 'accepted' }]);
	});

	it('keeps a given id and surfaces a rejection', async () => {
		const id = '9b2e1c55-2d1f-4f0a-8d0e-2f6e0a7d4c11';
		const authenticated = transportReturning(ok({ farm_id: FARM, results: [{ id, result: 'rejected' }] }));
		await expect(
			runOperation('operation', 'register', reader({ ...values, operationId: id }), runtime(authenticated)),
		).rejects.toThrow(AgroGpsInputError);
		expect(authenticated.mock.calls[0][0].body.entries[0].id).toBe(id);
	});

	it('reports a non-numeric quantity', async () => {
		await expect(
			runOperation('operation', 'register', reader({ ...values, quantity: 'lots' }), runtime()),
		).rejects.toThrow('Quantity');
	});
});

it('rejects unknown operations', async () => {
	await expect(runOperation('farm', 'delete', reader({}), runtime())).rejects.toThrow('Unsupported operation: farm / delete');
});
