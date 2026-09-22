import { describe, expect, it, vi } from 'vitest';
import type { GizmoExtension, View } from '@gizmo/extension-api';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExtensionUiService } from '../../src/extensions/extension-ui-service';
import { ExtensionSettingsStore } from '../../src/extensions/extension-settings-store';

const view = (text: string): View => ({
	title: 'Hello',
	blocks: [{ type: 'text', text }],
});

function fixture() {
	const disposed: string[] = [];
	let push: ((view: View) => void) | undefined;
	const action = vi.fn(async () => ({ status: 'succeeded' as const }));
	const extension: GizmoExtension = {
		id: 'hello',
		name: 'Hello',
		settings: [{ kind: 'boolean', key: 'loud', label: 'Loud' }],
		toolPresentation: { labels: { hello_say: 'Say hello' } },
		statusItems: () => [{ id: 'status', label: 'ok' }],
		commands: () => [{ id: 'wave', label: 'Wave' }],
		runCommand: vi.fn(),
		views: {
			main: {
				label: 'Hello',
				open(context) {
					push = context.update;
					context.update(view(`first ${String(context.settings.loud)}`));
					return {
						action,
						dispose: () => {
							disposed.push('main');
						},
					};
				},
			},
			thread: {
				label: 'Thread',
				scope: 'thread',
				open(context) {
					context.update(view(context.sessionId ?? 'none'));
					return { dispose() {} };
				},
			},
		},
	};
	const viewUpdated = vi.fn();
	const settingsChanged = vi.fn();
	const uiChanged = vi.fn();
	// A temp file keeps the suite away from the developer's own settings.
	const store = new ExtensionSettingsStore(
		join(
			mkdtempSync(join(tmpdir(), 'gizmo-ext-ui-')),
			'extension-settings.json',
		),
	);
	const ui = new ExtensionUiService(
		[extension],
		{ viewUpdated, settingsChanged, uiChanged },
		undefined,
		store,
	);
	return {
		ui,
		extension,
		viewUpdated,
		settingsChanged,
		uiChanged,
		disposed,
		push: () => push!,
		action,
	};
}

const address = { projectPath: '/ws', extensionId: 'hello', viewId: 'main' };

describe('ExtensionUiService', () => {
	it('lists contributions as data', async () => {
		const { ui } = fixture();
		expect(await ui.list('/ws')).toEqual([
			{
				id: 'hello',
				name: 'Hello',
				views: [
					{
						id: 'main',
						label: 'Hello',
						scope: 'workspace',
						placement: 'inspector',
					},
					{
						id: 'thread',
						label: 'Thread',
						scope: 'thread',
						placement: 'inspector',
					},
				],
				statusItems: [{ id: 'status', label: 'ok' }],
				commands: [{ id: 'wave', label: 'Wave' }],
				settings: [{ kind: 'boolean', key: 'loud', label: 'Loud' }],
				settingsValues: {},
				toolPresentation: { labels: { hello_say: 'Say hello' } },
				hasProjectService: false,
			},
		]);
	});

	it('opens a view once for several owners and closes it with the last', async () => {
		const { ui, viewUpdated, disposed, push } = fixture();
		const a = {};
		const b = {};
		await ui.setSettings('hello', { loud: true });
		expect(await ui.open(a, address)).toEqual(view('first true'));
		expect(await ui.open(b, address)).toEqual(view('first true'));
		expect(viewUpdated).toHaveBeenCalledTimes(1);
		push()(view('second'));
		expect(viewUpdated).toHaveBeenLastCalledWith(
			{ ...address, sessionId: undefined },
			view('second'),
		);
		ui.close(a, address);
		expect(disposed).toEqual([]);
		ui.release(b);
		await vi.waitFor(() => expect(disposed).toEqual(['main']));
		// Updates after close are dropped.
		push()(view('late'));
		expect(viewUpdated).toHaveBeenCalledTimes(2);
	});

	it('drops an invalid view with a warning instead of sending it', async () => {
		const { ui, viewUpdated, push } = fixture();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await ui.open({}, address);
		push()({ title: 'x', blocks: [{ type: 'nope' } as never] });
		expect(viewUpdated).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid view'));
		warn.mockRestore();
	});

	it('routes actions to the open view and reports failures as results', async () => {
		const { ui, action } = fixture();
		await ui.open({}, address);
		const event = { actionId: 'go', cancelled: false };
		expect(await ui.action(address, event)).toEqual({ status: 'succeeded' });
		expect(action).toHaveBeenCalledWith(event);
		action.mockRejectedValueOnce(new Error('boom'));
		expect(await ui.action(address, event)).toEqual({
			status: 'failed',
			message: 'boom',
		});
		await expect(
			ui.action({ ...address, viewId: 'thread' }, event),
		).rejects.toThrow('not open');
	});

	it('keeps thread views apart by session and requires one', async () => {
		const { ui } = fixture();
		const thread = { ...address, viewId: 'thread' };
		await expect(ui.open({}, thread)).rejects.toThrow('needs a thread');
		expect(await ui.open({}, { ...thread, sessionId: 's1' })).toEqual(
			view('s1'),
		);
		expect(await ui.open({}, { ...thread, sessionId: 's2' })).toEqual(
			view('s2'),
		);
	});

	it('runs commands and resets every view on reload', async () => {
		const { ui, extension, disposed } = fixture();
		await ui.runCommand('/ws', 'hello', 'wave');
		expect(extension.runCommand).toHaveBeenCalledWith('wave', {
			workspacePath: '/ws',
			settings: {},
			complete: expect.any(Function),
		});
		await ui.open({}, address);
		await ui.reset();
		expect(disposed).toEqual(['main']);
		await expect(
			ui.action(address, { actionId: 'go', cancelled: false }),
		).rejects.toThrow('not open');
	});
});

it('normalizes workspace view addresses even when the client supplies a session', async () => {
	const { ui, disposed, viewUpdated } = fixture();
	const a = {},
		b = {};
	await ui.open(a, { ...address, sessionId: 's1' });
	await ui.open(b, { ...address, sessionId: 's2' });
	expect(viewUpdated).toHaveBeenCalledTimes(1);
	ui.close(a, { ...address, sessionId: 's1' });
	ui.close(b, { ...address, sessionId: 's2' });
	await vi.waitFor(() => expect(disposed).toEqual(['main']));
});

it('resolves equal workspace-local ids only within their own workspace', async () => {
	const first = fixture().extension;
	const second = { ...first, name: 'Other', workspaceRoot: '/other' };
	const ui = new ExtensionUiService(
		[{ ...first, workspaceRoot: '/ws' }, second],
		{ viewUpdated() {} },
	);
	expect((await ui.list('/other')).map(({ name }) => name)).toEqual(['Other']);
	expect(await ui.list('/unrelated')).toEqual([]);
	await expect(
		ui.open({}, { ...address, projectPath: '/unrelated' }),
	).rejects.toThrow('not installed');
});
