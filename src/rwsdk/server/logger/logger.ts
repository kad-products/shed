import { env } from 'cloudflare:workers';
import { Chalk } from 'chalk';
import { makeTaggedTemplate } from 'chalk-template';
import type { KADLogger, LogLevel } from '../../types/kad-logger';

// chalk cannot detect color support inside the Worker runtime (no process.stdout),
// so we force level 1 (16-color ANSI) rather than letting it default to 0 (no color).
const chalk = makeTaggedTemplate(new Chalk({ level: 1 }));

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Matches any key name containing these substrings (case-insensitive), e.g. publicKey, apiKey, accessToken, clientSecret.
const REDACTED_PATTERN = /password|secret|token|key/i;
const CENSOR = '[Redacted]';

function redact(value: unknown): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map(redact);
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACTED_PATTERN.test(k) ? CENSOR : redact(v)]),
	);
}

function parseLevel(level: string | undefined, fallback: LogLevel): LogLevel {
	if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') return level;
	return fallback;
}

function parseTaskOverrides(overrides: string | undefined): Map<string, LogLevel> {
	const map = new Map<string, LogLevel>();
	if (!overrides) return map;
	for (const entry of overrides.split(',')) {
		const [task, level] = entry.split(':').map(s => s.trim());
		if (task && (level === 'debug' || level === 'info' || level === 'warn' || level === 'error')) {
			map.set(task, level);
		}
	}
	return map;
}

function serializeError(err: Error): Record<string, unknown> {
	const result: Record<string, unknown> = {
		// Spread enumerable own properties (e.g. DrizzleQueryError.query, .params, .name,
		// and .cause when set as an instance property via `this.cause = x`).
		...err,
		// Always explicitly include non-enumerable standard Error properties.
		message: err.message,
		stack: err.stack,
	};

	// Always serialize cause explicitly so it is never silently dropped.
	// .cause can be enumerable (Drizzle pattern: `this.cause = x`) or non-enumerable
	// (ES2022 pattern: `new Error(msg, { cause })`). Either way it is readable as
	// err.cause, but JSON.stringify of a plain Error gives {} so we must serialize it.
	if (err.cause !== undefined) {
		result.cause = err.cause instanceof Error ? serializeError(err.cause) : err.cause;
	}

	return result;
}

// Walks up the call stack and returns "filename.ts:line" for the first frame
// outside this file. Only meaningful in dev where source maps are active.
function getCallerInfo(): string | undefined {
	try {
		const stack = new Error().stack;
		if (!stack) return undefined;
		for (const line of stack.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed.startsWith('at ')) continue;
			if (/logger\.[jt]s/.test(trimmed)) continue;
			const matches = trimmed.match(/\(?([^()\s]+):(\d+):\d+\)?$/);
			if (matches) {
				const rawPath = matches[1].replace(/^file:\/\//, '');
				const parts = rawPath.split('/');
				return `${parts.slice(-2).join('/')}:${matches[2]}`;
			}
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function write(
	level: LogLevel,
	message: string,
	minLevel: LogLevel,
	bindings: Record<string, unknown>,
	meta: Record<string, unknown> | undefined,
	caller?: string,
): void {
	if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
	const serializedMeta = meta
		? Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v instanceof Error ? serializeError(v) : v]))
		: undefined;
	const entry = { level, message, timestamp: new Date().toISOString(), ...bindings, ...serializedMeta };
	if (env.KAD_PRODUCTS_ENVIRONMENT === 'development') {
		const { level, message, timestamp, ...rest } = entry;
		const loc = caller ? ` [${caller}]` : '';
		if (level.toUpperCase() === 'WARN') {
			// biome-ignore lint/suspicious/noConsole: intentional single console.log point for the logger
			console.log(chalk`{bold ${timestamp}} {yellow ${level.toUpperCase()}}${loc} {white ${message}}`);
		} else if (level.toUpperCase() === 'ERROR') {
			// biome-ignore lint/suspicious/noConsole: intentional single console.log point for the logger
			console.log(chalk`{bold ${timestamp}} {red ${level.toUpperCase()}}${loc} {white ${message}}`);
		} else {
			// biome-ignore lint/suspicious/noConsole: intentional single console.log point for the logger
			console.log(chalk`{bold ${timestamp}} {white ${level.toUpperCase()}}${loc} {white ${message}}`);
		}

		Object.entries(rest).forEach(([key, value]) => {
			if (REDACTED_PATTERN.test(key)) {
				// biome-ignore lint/suspicious/noConsole: structured log output — intentional single console.log point for the logger
				console.log(chalk`  {cyan ${key}}: {red ${CENSOR}}`);
			} else {
				if (typeof value === 'object') {
					// biome-ignore lint/suspicious/noConsole: structured log output — intentional single console.log point for the logger
					console.log(chalk`  {cyan ${key}}: {white ${JSON.stringify(value, null, 4)}}`);
				} else {
					// biome-ignore lint/suspicious/noConsole: structured log output — intentional single console.log point for the logger
					console.log(chalk`  {cyan ${key}}: {white ${JSON.stringify(value)}}`);
				}
			}
		});
	} else {
		// biome-ignore lint/suspicious/noConsole: structured log output — intentional single console.log point for the logger
		console.log(JSON.stringify(redact(entry)));
	}
}

function buildLogger(bindings: Record<string, unknown>, level: LogLevel, taskOverrides: Map<string, LogLevel>): KADLogger {
	const isDev = env.KAD_PRODUCTS_ENVIRONMENT === 'development';
	return {
		debug: (message: string, meta?: Record<string, unknown>) =>
			write('debug', message, level, bindings, meta, isDev ? getCallerInfo() : undefined),
		info: (message: string, meta?: Record<string, unknown>) =>
			write('info', message, level, bindings, meta, isDev ? getCallerInfo() : undefined),
		warn: (message: string, meta?: Record<string, unknown>) =>
			write('warn', message, level, bindings, meta, isDev ? getCallerInfo() : undefined),
		error: (message: string, meta?: Record<string, unknown>) =>
			write('error', message, level, bindings, meta, isDev ? getCallerInfo() : undefined),
		child(childBindings: Record<string, unknown>, levelOverride?: LogLevel): KADLogger {
			const taskLevel = typeof childBindings.task === 'string' ? taskOverrides.get(childBindings.task) : undefined;
			return buildLogger({ ...bindings, ...childBindings }, levelOverride ?? taskLevel ?? level, taskOverrides);
		},
	};
}

export function createLogger(bindings: Record<string, unknown>): KADLogger {
	const level = parseLevel(env.LOG_LEVEL, 'info');
	const taskOverrides = parseTaskOverrides(env.LOG_LEVEL_TASK_OVERRIDE);
	return buildLogger(bindings, level, taskOverrides);
}

export function createRequestLogger(request: Request): KADLogger {
	return createLogger({
		correlationId: request.headers.get('cf-ray') ?? crypto.randomUUID(),
		path: new URL(request.url).pathname,
	});
}

export function createNoopLogger(): KADLogger {
	const noop = (): void => {};
	return {
		debug: noop,
		info: noop,
		warn: noop,
		error: noop,
		child: () => createNoopLogger(),
	};
}
