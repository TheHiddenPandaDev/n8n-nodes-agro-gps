export const API_BASE_URL = 'https://api.agrogps.eu';

export const CREDENTIAL_NAME = 'agroGpsApi';

export const MAX_FIELDS_PER_IMPORT = 50;

export const MAX_RECORD_PAGES = 200;

export const MIN_POLYGON_POINTS = 3;

export const MAX_SEARCH_LENGTH = 100;

export const MIN_SEARCH_LENGTH = 3;

export const PARCEL_RECORD_KIND = 'parcel';

export const DEFAULT_COUNTRY = 'ES';

export const COUNTRY_NAMES: Record<string, string> = {
	AT: 'Austria',
	BE: 'Belgium',
	BG: 'Bulgaria',
	CH: 'Switzerland',
	CY: 'Cyprus',
	CZ: 'Czechia',
	DE: 'Germany',
	DK: 'Denmark',
	EE: 'Estonia',
	ES: 'Spain',
	FI: 'Finland',
	FR: 'France',
	GB: 'United Kingdom',
	GR: 'Greece',
	HR: 'Croatia',
	HU: 'Hungary',
	IE: 'Ireland',
	IS: 'Iceland',
	IT: 'Italy',
	LI: 'Liechtenstein',
	LT: 'Lithuania',
	LU: 'Luxembourg',
	LV: 'Latvia',
	MT: 'Malta',
	NL: 'Netherlands',
	NO: 'Norway',
	PL: 'Poland',
	PT: 'Portugal',
	RO: 'Romania',
	SE: 'Sweden',
	SI: 'Slovenia',
	SK: 'Slovakia',
};

export const ENTRY_TYPES: Record<string, string> = {
	treatment: 'Plant Protection Treatment',
	seed_treatment: 'Seed Treatment',
	fertilizing: 'Fertilizing',
	fertilization_plan: 'Fertilization Plan',
	planting: 'Sowing or Planting',
	harvest: 'Harvest',
	irrigation: 'Irrigation',
	cultural_work: 'Cultural Work',
	cover_crop: 'Cover Crop',
	grazing: 'Grazing',
	analysis: 'Soil or Leaf Analysis',
	energy: 'Energy Use',
	postharvest: 'Post-Harvest Treatment',
	observation: 'Observation',
	expense: 'Expense',
	sale: 'Sale',
};
