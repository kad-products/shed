import { describe, expect, it } from 'vitest';
import { KADRepositoryError, KADRepositoryErrorTypes } from '../kad-repository-error';

describe('KADRepositoryError', () => {
	it('is an instance of Error', () => {
		expect(new KADRepositoryError(KADRepositoryErrorTypes.UnexpectedRecordCount, [0, 1, 'user'])).toBeInstanceOf(Error);
	});

	it('has name KADRepositoryError', () => {
		const err = new KADRepositoryError(KADRepositoryErrorTypes.UnexpectedRecordCount, [0, 1, 'user']);
		expect(err.name).toBe('KADRepositoryError');
	});

	it('stores type on the instance', () => {
		const err = new KADRepositoryError(KADRepositoryErrorTypes.InvalidUUID, ['abc', 'game']);
		expect(err.type).toBe(KADRepositoryErrorTypes.InvalidUUID);
	});

	describe('UnexpectedRecordCount', () => {
		it('formats the message with actual, expected, and entity', () => {
			const err = new KADRepositoryError(KADRepositoryErrorTypes.UnexpectedRecordCount, [0, 1, 'user']);
			expect(err.message).toBe('Expected 1 user record(s), but found 0');
		});
	});

	describe('InvalidUUID', () => {
		it('formats the message with the value and entity', () => {
			const err = new KADRepositoryError(KADRepositoryErrorTypes.InvalidUUID, ['not-a-uuid', 'game']);
			expect(err.message).toBe('The value "not-a-uuid" is not a valid ID for a game');
		});
	});

	describe('SingleInstanceError', () => {
		it('uses the provided message directly', () => {
			const err = new KADRepositoryError(KADRepositoryErrorTypes.SingleInstanceError, ['Only one active game allowed']);
			expect(err.message).toBe('Only one active game allowed');
		});
	});

	describe('unknown type (default branch)', () => {
		it('falls back to the generic message', () => {
			const err = new KADRepositoryError('not-a-real-type' as any, []);
			expect(err.message).toBe('An unknown repository error occurred');
		});
	});
});
