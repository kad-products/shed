export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface KADLogger {
	debug(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
	child(bindings: Record<string, unknown>, levelOverride?: LogLevel): KADLogger;
}
