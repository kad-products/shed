// rwsdk/server — server-side utilities and classes for RedwoodSDK projects
// Safe to import cloudflare:workers here. Do NOT import client components.

import * as kadClasses from './classes';
import { handlePageError } from './worker-error';

// biome-ignore lint/nursery/useExplicitType: nursery rule; type inferred from literal
export const classes = kadClasses;

// biome-ignore lint/nursery/useExplicitType: nursery rule; type inferred from literal
export const pages = {
	handlePageError,
};
