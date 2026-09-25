import { env } from 'cloudflare:workers';
import type { JSX } from 'react';
import type { DefaultAppContext, RequestInfo } from 'rwsdk/worker';
import { KADAccessError } from './classes';
import RootErrorHandler from './components/RootErrorHandler';

/**
 * Builds a human-readable error message that walks the full cause chain.
 * Use this in client-facing error responses in non-production environments
 * so that underlying SQLite / Drizzle errors are visible.
 */
export function buildDevErrorMessage(err: unknown): string {
	if (!(err instanceof Error)) return String(err);
	const parts: string[] = [err.message];
	let cause: unknown = err.cause;
	while (cause instanceof Error) {
		parts.push(cause.message);
		cause = cause.cause;
	}
	if (cause !== undefined) {
		parts.push(String(cause));
	}
	return parts.join(' → ');
}

/**
 * Top-level error handler for the render tree. Exported for unit testing.
 *
 * Branches on request type, not error class:
 * - Server action requests (identified by the __rsc_action_id query param that
 *   rwsdk stamps on every action call) always get a JSON ActionState response
 *   so the form layer can surface the error.
 * - Page navigation requests always get the React RootErrorHandler component.
 */
export function handlePageError(error: unknown, { request }: RequestInfo<DefaultAppContext>): Response | JSX.Element {
	const isActionRequest = new URL(request.url).searchParams.has('__rsc_action_id');

	if (isActionRequest) {
		const isDev = env.KAD_PRODUCTS_ENVIRONMENT !== 'production';
		const message =
			isDev && error instanceof Error
				? buildDevErrorMessage(error)
				: error instanceof Error
					? error.message
					: 'An unexpected error occurred';
		const code = error instanceof KADAccessError ? error.code : 500;
		return Response.json({ success: false, code, errors: { _form: [message] } }, { status: code });
	}
	return <RootErrorHandler error={error as Error} />;
}
