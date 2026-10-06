import { describe, expect, it } from 'vitest';
import {
	buildRequest,
	createFieldsRequest,
	farmsRequest,
	optionalText,
	parsePolygon,
	productRequest,
	productSearchRequest,
	recordsRequest,
	registerEntryRequest,
	requireCountry,
	requireFarmId,
	requireText,
} from '../nodes/AgroGps/shared/request-builder';
import { AgroGpsInputError } from '../nodes/AgroGps/shared/input-error';

const FARM = '5b0c7a52-6f4e-4d1d-9a4b-0b3f2c1d9e8f';
const ENTRY = '0f8fad5b-d9cb-469f-a165-70867728950e';

function entry(overrides = {}) {
	return {
		id: ENTRY,
		farmId: '',
		country: 'ES',
		parcelReference: '45098A01300012',
		entryType: 'treatment',
		title: 'Fungicida',
		eventAt: '2026-10-01T08:00:00Z',
		quantity: 0.3,
		unit: 'l/ha',
		registrationNumber: '25421',
		safetyDays: 14,
		...overrides,
	};
}

describe('buildRequest', () => {
	it('drops empty query values and keeps the body', () => {
		const request = buildRequest('POST', '/x', { a: 'b', c: '', d: undefined, e: 0 }, { k: 1 });
		expect(request).toMatchObject({ method: 'POST', url: 'https://api.agrogps.eu/x', qs: { a: 'b', e: 0 }, body: { k: 1 } });
		expect(request.ignoreHttpStatusErrors).toBe(true);
		expect(buildRequest('GET', '/y').body).toBeUndefined();
	});
});

describe('text and identifiers', () => {
	it('reads text, numbers and empties', () => {
		expect(requireText(' a ', 'X')).toBe('a');
		expect(requireText(7, 'X')).toBe('7');
		expect(() => requireText('  ', 'X')).toThrow(AgroGpsInputError);
		expect(optionalText(5)).toBe('5');
		expect(optionalText(null)).toBe('');
	});

	it('accepts known countries only', () => {
		expect(requireCountry(' de ')).toBe('DE');
		expect(() => requireCountry('XX')).toThrow('Unsupported country: XX');
		expect(() => requireCountry('')).toThrow('(empty)');
	});

	it('validates farm ids', () => {
		expect(requireFarmId('')).toBe('');
		expect(requireFarmId(FARM)).toBe(FARM);
		expect(() => requireFarmId('farm-1')).toThrow('UUID');
	});
});

describe('product requests', () => {
	it('builds the lookup with country and crop', () => {
		expect(productRequest(' 25421 ', 'es', 'trzaw')).toMatchObject({
			url: 'https://api.agrogps.eu/api/public/phyto/25421',
			qs: { country: 'ES', crop: 'TRZAW' },
		});
		expect(productRequest('ES-00123/45', 'ES', '').url).toContain('ES-00123%2F45');
	});

	it('bounds the search term', () => {
		expect(productSearchRequest('karate', 'FR')).toMatchObject({ qs: { q: 'karate', country: 'FR' } });
		expect(() => productSearchRequest('ka', 'FR')).toThrow('between 3 and 100');
		expect(() => productSearchRequest('k'.repeat(101), 'FR')).toThrow(AgroGpsInputError);
	});
});

describe('farm and record requests', () => {
	it('builds them', () => {
		expect(farmsRequest().url).toBe('https://api.agrogps.eu/api/v1/farms');
		expect(recordsRequest(FARM, 0)).toMatchObject({ qs: { farm_id: FARM, since: 0 } });
	});
});

describe('registerEntryRequest', () => {
	const now = new Date('2026-10-06T10:00:00Z');

	it('builds a full entry for the default farm', () => {
		const request = registerEntryRequest(entry(), now);
		expect(request.method).toBe('POST');
		expect(request.body).toEqual({
			country: 'ES',
			entries: [
				{
					id: ENTRY,
					parcel_refcat: '45098A01300012',
					entry_type: 'treatment',
					title: 'Fungicida',
					event_at: '2026-10-01T08:00:00.000Z',
					quantity: 0.3,
					unit: 'l/ha',
					registration_number: '25421',
					safety_days: 14,
					version: 1,
					client_created_at: '2026-10-06T10:00:00.000Z',
				},
			],
		});
	});

	it('sends the farm id when given and defaults missing numbers to zero', () => {
		const request = registerEntryRequest(entry({ farmId: FARM, quantity: undefined, safetyDays: 3.7 }), now);
		expect(request.body.farm_id).toBe(FARM);
		expect(request.body.entries[0].quantity).toBe(0);
		expect(request.body.entries[0].safety_days).toBe(3);
	});

	it('rejects bad input', () => {
		expect(() => registerEntryRequest(entry({ id: 'x' }), now)).toThrow('UUID');
		expect(() => registerEntryRequest(entry({ entryType: 'party' }), now)).toThrow('Unsupported operation type');
		expect(() => registerEntryRequest(entry({ eventAt: 'yesterday' }), now)).toThrow('valid date');
		expect(() => registerEntryRequest(entry({ eventAt: '' }), now)).toThrow('valid date');
		expect(() => registerEntryRequest(entry({ quantity: -1 }), now)).toThrow('Quantity');
		expect(() => registerEntryRequest(entry({ safetyDays: Number.NaN }), now)).toThrow('Safety Days');
		expect(() => registerEntryRequest(entry({ title: '' }), now)).toThrow('Title');
		expect(() => registerEntryRequest(entry({ parcelReference: '' }), now)).toThrow('Field Reference');
	});
});

describe('createFieldsRequest', () => {
	const field = { farmId: FARM, name: 'Norte', country: 'ES', cropCode: 'HORVW', polygon: [[1, 2], [1, 3], [2, 3]] };

	it('builds the import body', () => {
		expect(createFieldsRequest([field]).body).toEqual({
			farm_id: FARM,
			fields: [{ name: 'Norte', country: 'ES', crop_code: 'HORVW', polygon: field.polygon }],
		});
		expect(createFieldsRequest([{ ...field, farmId: '' }]).body.farm_id).toBeUndefined();
	});

	it('enforces the batch limits and the name', () => {
		expect(() => createFieldsRequest([])).toThrow('at least one');
		expect(() => createFieldsRequest(Array(51).fill(field))).toThrow('at most 50');
		expect(() => createFieldsRequest([{ ...field, name: ' ' }])).toThrow('Field Name');
	});
});

describe('parsePolygon', () => {
	it('accepts lat/lng arrays and JSON strings, dropping the closing point', () => {
		expect(parsePolygon([[1, 2], [1, 3], [2, 3], [1, 2]])).toEqual([[1, 2], [1, 3], [2, 3]]);
		expect(parsePolygon('[[1,2],[1,3],[2,3]]')).toEqual([[1, 2], [1, 3], [2, 3]]);
		expect(parsePolygon([['1', '2'], [1, 3], [2, 3], 'junk', [5]])).toEqual([[1, 2], [1, 3], [2, 3]]);
	});

	it('accepts GeoJSON Polygon, MultiPolygon and Feature in lng/lat order', () => {
		const ring = [[2, 1], [3, 1], [3, 2], [2, 1]];
		const expected = [[1, 2], [1, 3], [2, 3]];
		expect(parsePolygon({ type: 'Polygon', coordinates: [ring] })).toEqual(expected);
		expect(parsePolygon({ type: 'MultiPolygon', coordinates: [[ring]] })).toEqual(expected);
		expect(parsePolygon(JSON.stringify({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }))).toEqual(expected);
	});

	it('rejects invalid shapes', () => {
		expect(() => parsePolygon('{not json')).toThrow('must be JSON');
		expect(() => parsePolygon({ type: 'Point', coordinates: [1, 2] })).toThrow('GeoJSON must be');
		expect(() => parsePolygon({ type: 'Feature' })).toThrow('GeoJSON must be');
		expect(() => parsePolygon({ type: 'Polygon' })).toThrow('at least 3');
		expect(() => parsePolygon({ type: 'MultiPolygon', coordinates: [] })).toThrow('at least 3');
		expect(() => parsePolygon([[1, 2], [1, 3]])).toThrow('at least 3');
		expect(() => parsePolygon([[100, 2], [1, 3], [2, 3]])).toThrow('[latitude, longitude]');
		expect(() => parsePolygon(42)).toThrow('at least 3');
	});
});
