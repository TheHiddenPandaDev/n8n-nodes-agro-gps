import { describe, expect, it } from 'vitest';
import {
	compact,
	mapCreatedFields,
	mapEntryResults,
	mapFarms,
	mapField,
	mapMatches,
	mapProduct,
	parcelRecords,
	unwrapData,
} from '../nodes/AgroGps/shared/response-mapper';
import { farms, recordsPage1, recordsPage2, sherpa } from './fixtures.mjs';

describe('response mapping', () => {
	it('unwraps the envelope', () => {
		expect(unwrapData({ success: true, data: [1] })).toEqual([1]);
		expect(unwrapData([2])).toEqual([2]);
	});

	it('compacts empty values', () => {
		expect(compact({ a: 1, b: '', c: null, d: undefined, e: 0 })).toEqual({ a: 1, e: 0 });
	});

	it('returns the product or one item per use', () => {
		expect(mapProduct(sherpa, false)).toEqual([sherpa]);
		const split = mapProduct(sherpa, true);
		expect(split).toHaveLength(2);
		expect(split[1]).toMatchObject({ name: 'SHERPA 100 EW', use: { crop: 'Trigo' } });
		expect(split[1].uses).toBeUndefined();
		expect(mapProduct({ name: 'X' }, true)).toEqual([{ name: 'X', use: null }]);
		expect(mapProduct(null, false)).toEqual([{}]);
	});

	it('lists matches and farms', () => {
		expect(mapMatches({ matches: [{ name: 'A' }, 'bad'] })).toEqual([{ name: 'A' }, {}]);
		expect(mapMatches(undefined)).toEqual([]);
		expect(mapFarms(farms)).toHaveLength(1);
		expect(mapFarms({ farms })).toHaveLength(1);
	});

	it('keeps the latest live parcel records only', () => {
		const records = parcelRecords([recordsPage1, recordsPage2]);
		expect(records.map((r) => r.id).sort()).toEqual(['p-2', 'p-3']);
	});

	it('maps a field with and without geometry', () => {
		const record = recordsPage1.records[0];
		expect(mapField(record, false, 'f-1')).toEqual({
			id: 'p-2',
			farm_id: 'f-1',
			name: 'Olivar',
			crop_code: 'OLVEU',
			country: 'ES',
			surface_ha: 2.1,
		});
		expect(mapField(record, true, 'f-1').polygon).toHaveLength(3);
		expect(mapField({ id: 'p-9' }, true, 'f-1')).toEqual({ id: 'p-9', farm_id: 'f-1', name: 'p-9' });
	});

	it('maps push and import results', () => {
		expect(mapEntryResults({ farm_id: 'f', results: [{ id: 'e', result: 'accepted' }] })).toEqual([
			{ farm_id: 'f', id: 'e', result: 'accepted' },
		]);
		expect(mapCreatedFields({ farm_id: 'f', fields: [{ id: 'DRAWN-1', name: 'N' }] })).toEqual([
			{ farm_id: 'f', id: 'DRAWN-1', name: 'N' },
		]);
	});
});
