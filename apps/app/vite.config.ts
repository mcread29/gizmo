import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte()],
	server: {
		strictPort: true,
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
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
	},
});
