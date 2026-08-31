import { cleanup, render } from '@testing-library/svelte';
import { afterEach, beforeEach } from 'vitest';
import App from '../../src/App.svelte';
import { FakeAgentClient } from '../../src/lib/agent-client';
import { toasts } from '../../src/lib/toasts.svelte.ts';

const initialInnerWidth = window.innerWidth;

export function setupAppIntegrationTests() {
	beforeEach(() => {
		localStorage.clear();
		// Routes live in the fragment, so a leftover page would open the next test
		// on the wrong screen.
		history.replaceState(null, '', '#');
	});

	afterEach(() => {
		cleanup();
		// Toasts are a module-level singleton with real dismissal timers; without
		// this a toast shown by an earlier test lingers into the next one and
		// races any assertion that looks up a toast by role.
		toasts.clear();
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: initialInnerWidth,
		});
	});
}

export function renderApp() {
	return render(App, { client: new FakeAgentClient({ latencyMs: 0 }) });
}
