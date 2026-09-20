import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

/*
 * Both ports are configurable so a dev server can run beside an installed
 * Gizmo service — which holds 8787 — rather than only instead of it.
 */
const agentPort = Number(process.env.GIZMO_PORT ?? 8787);
const devPort = Number(process.env.GIZMO_DEV_PORT ?? 5173);

export default defineConfig({
	plugins: [svelte()],
	clearScreen: false,
	server: {
		host: process.env.GIZMO_DEV_HOST || false,
		port: devPort,
		strictPort: true,
		proxy: {
			'/agent': {
				target: `ws://127.0.0.1:${agentPort}`,
				ws: true,
			},
		},
	},
	// `vite preview` serves the production build for the always-on web server.
	// The built client derives its socket URL from window.location, so the
	// preview server has to proxy /agent the same way the dev server does.
	preview: {
		strictPort: true,
		// Vite rejects unknown Host headers, which would otherwise 403 every
		// request that arrives by MagicDNS name rather than by raw IP.
		...(process.env.GIZMO_WEB_ALLOWED_HOSTS
			? { allowedHosts: process.env.GIZMO_WEB_ALLOWED_HOSTS.split(',') }
			: {}),
		proxy: {
			'/agent': {
				target: 'ws://127.0.0.1:8787',
				ws: true,
			},
		},
	},
	resolve: {
		conditions: ['browser'],
	},
	build: {
		minify: process.env.GIZMO_DEBUG_BUILD ? false : 'esbuild',
		sourcemap: Boolean(process.env.GIZMO_DEBUG_BUILD),
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'markdown',
							test: /node_modules[\\/](?:dompurify|highlight\.js|marked)[\\/]/,
							priority: 30,
						},
						{
							name: 'ui-vendor',
							test: /node_modules[\\/](?:@floating-ui[\\/]|@lucide[\\/]svelte|@tanstack[\\/]|bits-ui[\\/]|tabbable[\\/])/,
							priority: 20,
						},
						{
							name: 'schema',
							test: /node_modules[\\/]typebox[\\/]/,
							priority: 10,
						},
						{
							name: 'vendor',
							test: /node_modules[\\/]/,
						},
					],
				},
			},
		},
	},
	test: {
		// Svelte + jsdom workers are large; keep local runs safe on shared hosts.
		maxWorkers: 1,
		execArgv: ['--max-old-space-size=1024'],
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['./tests/setup.ts'],
	},
});
