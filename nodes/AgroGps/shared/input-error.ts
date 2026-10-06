export class AgroGpsInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AgroGpsInputError';
	}
}
