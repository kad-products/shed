export class KADAccessError extends Error {
	constructor(
		public code: number,
		message: string,
	) {
		super(message);
		this.name = 'KADAccessError';
	}
}
