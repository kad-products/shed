import { describe, expect, it } from 'vitest';
import { KADStepError } from '../kad-step-error';

describe('KADStepError', () => {
	const base = new KADStepError(500, 'Something went wrong', 'Internal: db connection lost');

	it('is an instance of Error', () => {
		expect(base).toBeInstanceOf(Error);
	});

	it('has name KADStepError', () => {
		expect(base.name).toBe('KADStepError');
	});

	it('stores code on the instance', () => {
		expect(base.code).toBe(500);
	});

	it('stores publicMessage on the instance', () => {
		expect(base.publicMessage).toBe('Something went wrong');
	});

	it('stores devMessage on the instance', () => {
		expect(base.devMessage).toBe('Internal: db connection lost');
	});

	it('sets message to devMessage', () => {
		expect(base.message).toBe('Internal: db connection lost');
	});

	it('defaults retryable to false', () => {
		expect(base.retryable).toBe(false);
	});

	it('stores retryable when explicitly set to true', () => {
		const err = new KADStepError(503, 'Try again', 'Upstream timeout', true);
		expect(err.retryable).toBe(true);
	});

	it('stores cause when provided', () => {
		const cause = new Error('original');
		const err = new KADStepError(500, 'Oops', 'details', false, cause);
		expect(err.cause).toBe(cause);
	});

	it('has no cause when omitted', () => {
		expect(base.cause).toBeUndefined();
	});
});
