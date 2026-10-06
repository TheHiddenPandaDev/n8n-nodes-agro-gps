import type { IDataObject } from 'n8n-workflow';
import { PARCEL_RECORD_KIND } from './constants';

export function asObject(value: unknown): IDataObject {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as IDataObject) : {};
}

function asList(value: unknown): IDataObject[] {
	return Array.isArray(value) ? value.map(asObject) : [];
}

export function unwrapData(body: unknown): unknown {
	const envelope = asObject(body);
	return 'data' in envelope ? envelope.data : body;
}

export function compact(value: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, item] of Object.entries(value)) {
		if (item !== undefined && item !== null && item !== '') out[key] = item;
	}
	return out;
}

export function mapProduct(data: unknown, splitUses: boolean): IDataObject[] {
	const product = asObject(data);
	if (!splitUses) return [product];
	const uses = asList(product.uses);
	const rest: IDataObject = { ...product };
	delete rest.uses;
	if (uses.length === 0) return [{ ...rest, use: null }];
	return uses.map((use) => ({ ...rest, use }));
}

export function mapMatches(data: unknown): IDataObject[] {
	return asList(asObject(data).matches);
}

export function mapFarms(data: unknown): IDataObject[] {
	const list = Array.isArray(data) ? data : asObject(data).farms;
	return asList(list).filter((farm) => typeof farm.id === 'string' && farm.id !== '');
}

export function mapField(record: IDataObject, includeGeometry: boolean, farmId: string): IDataObject {
	const payload = asObject(record.payload);
	const field = compact({
		id: record.id,
		farm_id: farmId,
		name: payload.name ?? record.id,
		reference: payload.refcat,
		crop_code: payload.crop_code,
		country: payload.country,
		surface_ha: payload.surface_ha,
	});
	if (includeGeometry && Array.isArray(payload.polygon)) field.polygon = payload.polygon;
	return field;
}

export function parcelRecords(pages: unknown[]): IDataObject[] {
	const byId = new Map<string, IDataObject>();
	for (const page of pages) {
		for (const record of asList(asObject(page).records)) {
			if (record.kind === PARCEL_RECORD_KIND && typeof record.id === 'string' && record.id) {
				byId.set(record.id, record);
			}
		}
	}
	return [...byId.values()].filter((record) => record.deleted !== true);
}

export function mapEntryResults(data: unknown): IDataObject[] {
	const body = asObject(data);
	return asList(body.results).map((result) => compact({ farm_id: body.farm_id, ...result }));
}

export function mapCreatedFields(data: unknown): IDataObject[] {
	const body = asObject(data);
	return asList(body.fields).map((field) => compact({ farm_id: body.farm_id, ...field }));
}
