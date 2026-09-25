import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		'rwsdk-server': 'src/rwsdk/server/index.ts',
		'rwsdk-client': 'src/rwsdk/client/index.ts',
	},
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	external: ['cloudflare:workers'],
});
