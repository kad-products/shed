export const KADRepositoryErrorTypes = {
	UnexpectedRecordCount: 'unexpected-record-count',
	InvalidUUID: 'invalid-uuid',
	SingleInstanceError: 'single-instance-error',
} as const;

export class KADRepositoryError extends Error {
	constructor(
		public type: (typeof KADRepositoryErrorTypes)[keyof typeof KADRepositoryErrorTypes],
		public details: unknown[],
	) {
		let message = '';
		switch (type) {
			case KADRepositoryErrorTypes.UnexpectedRecordCount: {
				const [actual, expected, entity] = details as [number, number, string];
				message = `Expected ${expected} ${entity} record(s), but found ${actual}`;
				break;
			}
			case KADRepositoryErrorTypes.InvalidUUID: {
				const [value, entity] = details as [string, string];
				message = `The value "${value}" is not a valid ID for a ${entity}`;
				break;
			}
			case KADRepositoryErrorTypes.SingleInstanceError: {
				const [singleInstanceMessage] = details as [string];
				message = singleInstanceMessage;
				break;
			}
			default:
				message = 'An unknown repository error occurred';
		}
		super(message);
		this.name = 'KADRepositoryError';
		this.type = type;
	}
}
