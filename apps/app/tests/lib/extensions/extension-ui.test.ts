import { describe, expect, it, vi } from 'vitest';
import type { ExtensionUi } from '@gizmo/extension-api';
import type { AgentClient } from '../../../src/lib/agent-client/AgentClient';
import { ExtensionUiStore } from '../../../src/lib/extensions/extension-ui.svelte.ts';
import { extensionUiFixture } from './fixtures/ui.ts';

/** A client that records what it was asked for and replays queued catalogs. */
function client(catalogs: ExtensionUi[][]) {
	const calls: string[] = [];
	let listener: ((event: unknown) => void) | undefined;
	const fake = {
		subscribe: (next: (event: unknown) => void) => {
			listener = next;
			return () => (listener = undefined);
		},
		listExtensionUi: vi.fn(async (projectPath: string) => {
			calls.push(projectPath);
			return catalogs.shift() ?? [];
		}),
	} as unknown as AgentClient;
	return { calls, fake, emit: (event: unknown) => listener?.(event) };
}

/** Effects and the fetch they start settle on microtasks. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ExtensionUiStore', () => {
	it('fetches the catalog for the attached workspace', async () => {
		const { calls, fake } = client([[extensionUiFixture('git')]]);
		const store = new ExtensionUiStore();
		store.attach(fake, {
			selectedProjectPath: '/projects/game',
			sessionId: undefined,
		});
		await settle();

		expect(calls).toEqual(['/projects/game']);
		expect(store.extensions.map(({ id }) => id)).toEqual(['git']);
		store.detach();
	});

	it('re-fetches when the server reloads extensions', async () => {
		const { calls, fake, emit } = client([
			[extensionUiFixture('git')],
			[extensionUiFixture('git'), extensionUiFixture('unity')],
		]);
		const store = new ExtensionUiStore();
		store.attach(fake, {
			selectedProjectPath: '/projects/game',
			sessionId: undefined,
		});
		await settle();

		emit({ type: 'extensions.reloaded' });
		await settle();

		expect(calls.length).toBe(2);
		expect(store.extensions.map(({ id }) => id)).toEqual(['git', 'unity']);
		store.detach();
	});

	it('re-fetches on a ui change for this workspace or for every workspace', async () => {
		const { calls, fake, emit } = client([]);
		const store = new ExtensionUiStore();
		store.attach(fake, {
			selectedProjectPath: '/projects/game',
			sessionId: undefined,
		});
		await settle();
		expect(calls.length).toBe(1);

		emit({
			type: 'extensions.ui.changed',
			extensionId: 'git',
			projectPath: '/projects/other',
		});
		await settle();
		expect(calls.length).toBe(1);

		emit({
			type: 'extensions.ui.changed',
			extensionId: 'git',
			projectPath: '/projects/game',
		});
		await settle();
		expect(calls.length).toBe(2);

		// No project path means every workspace.
		emit({ type: 'extensions.ui.changed', extensionId: 'git' });
		await settle();
		expect(calls.length).toBe(3);
		store.detach();
	});

	it('answers tool presentation and project service lookups', () => {
		const store = new ExtensionUiStore();
		store.extensions = [
			extensionUiFixture('unity', {
				hasProjectService: true,
				toolPresentation: {
					labels: { unity_console: 'Unity console' },
					icons: { unity_console: 'plug-zap' },
					parameters: { unity_console: ['filter'] },
				},
			}),
		];

		expect(store.labelFor('unity_console')).toBe('Unity console');
		expect(store.iconFor('unity_console')).toBe('plug-zap');
		expect(store.parametersFor('unity_console')).toEqual(['filter']);
		expect(store.hasProjectService('unity')).toBe(true);
		expect(store.hasProjectService('git')).toBe(false);
	});
});
