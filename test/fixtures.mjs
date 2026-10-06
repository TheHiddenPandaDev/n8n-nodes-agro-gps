export function ok(data, headers = {}) {
	return { statusCode: 200, body: { success: true, data }, headers };
}

export function failure(statusCode, body = {}, headers = {}) {
	return { statusCode, body: { success: false, ...body }, headers };
}

export const sherpa = {
	registration_number: '25421',
	name: 'SHERPA 100 EW',
	register_country: 'ES',
	uses: [
		{ crop: 'Algodonero', target: 'Pulgones', dose_min: 0.3, dose_unit: 'l/ha', safety_days: 14 },
		{ crop: 'Trigo', target: 'Pulgones', dose_min: 0.25, dose_unit: 'l/ha', safety_days: 28 },
	],
};

export const farms = [
	{ id: '5b0c7a52-6f4e-4d1d-9a4b-0b3f2c1d9e8f', name: 'Finca Los Llanos', country: 'ES' },
	{ id: '', name: 'broken' },
];

export const recordsPage1 = {
	farm_id: farms[0].id,
	records: [
		{ kind: 'parcel', id: 'p-2', payload: { name: 'Olivar', crop_code: 'OLVEU', country: 'ES', surface_ha: 2.1, polygon: [[40, -3], [40.1, -3], [40.1, -3.1]] } },
		{ kind: 'machine', id: 'm-1', payload: {} },
		{ kind: 'parcel', id: 'p-1', payload: { name: 'Cebada', refcat: '45098A01300012' } },
	],
	next: 7,
	has_more: true,
};

export const recordsPage2 = {
	farm_id: farms[0].id,
	records: [{ kind: 'parcel', id: 'p-1', deleted: true, payload: { name: 'Cebada' } }, { kind: 'parcel', id: 'p-3', payload: { name: 'Almendros' } }],
	next: 9,
	has_more: false,
};
