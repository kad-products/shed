import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KADStepError } from '../classes';
import { createRequestLogger } from './logger';

const mockEnv = vi.hoisted(() => ({ LOG_LEVEL: 'debug', LOG_LEVEL_TASK_OVERRIDE: '' }));

vi.mock('cloudflare:workers', () => ({ env: mockEnv }));

describe('KADLogger', () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		mockEnv.LOG_LEVEL = 'debug';
		mockEnv.LOG_LEVEL_TASK_OVERRIDE = '';
	});

	afterEach(() => {
		consoleSpy.mockRestore();
	});

	function lastOutput(): Record<string, unknown> {
		const raw = consoleSpy.mock.calls.at(-1)?.[0];
		if (typeof raw !== 'string') throw new Error('No log output');
		return JSON.parse(raw) as Record<string, unknown>;
	}

	describe('createRequestLogger', () => {
		it('uses cf-ray header as correlationId', () => {
			const request = new Request('https://example.com/recipes', { headers: { 'cf-ray': 'ray-abc123' } });
			const logger = createRequestLogger(request);
			logger.info('test');
			expect(lastOutput().correlationId).toBe('ray-abc123');
		});

		it('falls back to a UUID when cf-ray header is absent', () => {
			const request = new Request('https://example.com/recipes');
			const logger = createRequestLogger(request);
			logger.info('test');
			const { correlationId } = lastOutput();
			expect(typeof correlationId).toBe('string');
			expect((correlationId as string).length).toBeGreaterThan(0);
		});

		it('includes the request path', () => {
			const request = new Request('https://example.com/recipes/123');
			const logger = createRequestLogger(request);
			logger.info('test');
			expect(lastOutput().path).toBe('/recipes/123');
		});

		it('outputs valid JSON with level, message, and timestamp', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.warn('something happened');
			const entry = lastOutput();
			expect(entry.level).toBe('warn');
			expect(entry.message).toBe('something happened');
			expect(typeof entry.timestamp).toBe('string');
		});
	});

	describe('level filtering', () => {
		it('logs messages at or above the configured level', () => {
			mockEnv.LOG_LEVEL = 'warn';
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.warn('this should log');
			logger.error('this should also log');
			expect(consoleSpy.mock.calls).toHaveLength(2);
		});

		it('suppresses messages below the configured level', () => {
			mockEnv.LOG_LEVEL = 'warn';
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.debug('filtered out');
			logger.info('also filtered out');
			expect(consoleSpy.mock.calls).toHaveLength(0);
		});

		it('falls back to info level when LOG_LEVEL is not a valid level', () => {
			mockEnv.LOG_LEVEL = 'verbose'; // not a valid level
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.debug('should be suppressed');
			logger.info('should be logged');
			expect(consoleSpy.mock.calls).toHaveLength(1);
			expect(lastOutput().level).toBe('info');
		});
	});

	describe('child logger', () => {
		it('inherits parent bindings', () => {
			const request = new Request('https://example.com/recipes', { headers: { 'cf-ray': 'ray-123' } });
			const logger = createRequestLogger(request);
			const child = logger.child({ userId: 'user-abc' });
			child.info('child log');
			const entry = lastOutput();
			expect(entry.correlationId).toBe('ray-123');
			expect(entry.userId).toBe('user-abc');
		});

		it('adds its own bindings without affecting the parent', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const child = logger.child({ task: 'scrape' });
			logger.info('parent log');
			child.info('child log');
			const calls = consoleSpy.mock.calls.map(([raw]: [unknown]) => JSON.parse(raw as string) as Record<string, unknown>);
			expect(calls[0].task).toBeUndefined();
			expect(calls[1].task).toBe('scrape');
		});

		it('applies task-level override from LOG_LEVEL_TASK_OVERRIDE', () => {
			mockEnv.LOG_LEVEL = 'info';
			mockEnv.LOG_LEVEL_TASK_OVERRIDE = 'passkey-validation:debug';
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const child = logger.child({ task: 'passkey-validation' });
			child.debug('verbose passkey log');
			expect(consoleSpy.mock.calls).toHaveLength(1);
			expect(lastOutput().task).toBe('passkey-validation');
		});

		it('parses multiple task overrides from a comma-separated list', () => {
			mockEnv.LOG_LEVEL = 'info';
			mockEnv.LOG_LEVEL_TASK_OVERRIDE = 'passkey-validation:debug,recipe-scrape:warn';
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.child({ task: 'passkey-validation' }).debug('should appear');
			logger.child({ task: 'recipe-scrape' }).info('should be suppressed');
			expect(consoleSpy.mock.calls).toHaveLength(1);
		});

		it('respects an explicit levelOverride argument', () => {
			mockEnv.LOG_LEVEL = 'info';
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const child = logger.child({ task: 'verbose-task' }, 'debug');
			child.debug('debug via override');
			expect(consoleSpy.mock.calls).toHaveLength(1);
		});
	});

	describe('redaction', () => {
		it('replaces top-level sensitive keys in meta with [Redacted]', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.info('auth attempt', { password: 'hunter2', userId: 'u-123' });
			const entry = lastOutput();
			expect(entry.password).toBe('[Redacted]');
			expect(entry.userId).toBe('u-123');
		});

		it('redacts nested sensitive keys inside objects', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.info('credential stored', { credential: { publicKey: new Uint8Array([1, 2, 3]), id: 'cred-abc' } });
			const entry = lastOutput();
			const credential = entry.credential as Record<string, unknown>;
			expect(credential.publicKey).toBe('[Redacted]');
			expect(credential.id).toBe('cred-abc');
		});

		it('redacts keys containing password, secret, token, or key as substrings', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.info('multi-redact', {
				password: 'pw',
				passwordHash: 'hash',
				secret: 'sec',
				clientSecret: 'cs',
				token: 'tok',
				accessToken: 'at',
				key: 'k',
				publicKey: 'pk',
				apiKey: 'ak',
			});
			const entry = lastOutput();
			for (const field of [
				'password',
				'passwordHash',
				'secret',
				'clientSecret',
				'token',
				'accessToken',
				'key',
				'publicKey',
				'apiKey',
			]) {
				expect(entry[field], `expected ${field} to be redacted`).toBe('[Redacted]');
			}
		});

		it('redacts sensitive keys inside a serialized error', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const err = Object.assign(new Error('credential error'), { publicKey: Buffer.from([1, 2, 3]) });
			logger.error('passkey failed', { error: err });
			const entry = lastOutput();
			const serializedError = entry.error as Record<string, unknown>;
			expect(serializedError.publicKey).toBe('[Redacted]');
			expect(serializedError.message).toBe('credential error');
		});

		it('leaves non-sensitive keys unchanged', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.info('safe log', { recipeId: 'r-123', publicMessage: 'hello', tags: ['pasta'] });
			const entry = lastOutput();
			expect(entry.recipeId).toBe('r-123');
			expect(entry.publicMessage).toBe('hello');
			expect(entry.tags).toEqual(['pasta']);
		});
	});

	describe('meta serialization', () => {
		it('merges meta fields into the log entry', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			logger.info('test', { recipeId: 'r-123', count: 5 });
			const entry = lastOutput();
			expect(entry.recipeId).toBe('r-123');
			expect(entry.count).toBe(5);
		});

		it('serializes Error instances in meta to { message, stack }', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const err = new Error('something broke');
			logger.error('operation failed', { error: err });
			const entry = lastOutput();
			const serializedError = entry.error as { message: string; stack: string };
			expect(serializedError.message).toBe('something broke');
			expect(typeof serializedError.stack).toBe('string');
		});

		it('includes Rz-specific error fields beyond message and stack', () => {
			const request = new Request('https://example.com/');
			const logger = createRequestLogger(request);
			const err = new KADStepError(400, 'Bad request', 'Invalid JSON body', false);
			logger.error('step failed', { error: err });
			const entry = lastOutput();
			const serializedError = entry.error as Record<string, unknown>;
			expect(serializedError.message).toBe('Invalid JSON body');
			expect(serializedError.code).toBe(400);
			expect(serializedError.publicMessage).toBe('Bad request');
			expect(serializedError.retryable).toBe(false);
		});
	});
});
