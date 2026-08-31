import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte()],
	clearScreen: false,
	server: {
		host: process.env.TAURI_DEV_HOST || false,
		strictPort: true,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
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
		minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
		sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['./tests/setup.ts'],
	},
});
