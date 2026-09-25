import { describe, expect, it } from 'vitest';
import { KADAccessError } from '../kad-access-error';

describe('KADAccessError', () => {
	it('is an instance of Error', () => {
		expect(new KADAccessError(403, 'Forbidden')).toBeInstanceOf(Error);
	});

	it('has name KADAccessError', () => {
		expect(new KADAccessError(403, 'Forbidden').name).toBe('KADAccessError');
	});

	it('stores code on the instance', () => {
		const err = new KADAccessError(401, 'Unauthorized');
		expect(err.code).toBe(401);
	});

	it('sets message from the constructor argument', () => {
		const err = new KADAccessError(403, 'Forbidden');
		expect(err.message).toBe('Forbidden');
	});
});
