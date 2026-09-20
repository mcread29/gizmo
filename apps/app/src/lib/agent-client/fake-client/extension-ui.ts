import type {
	ActionEvent,
	ActionResult,
	ExtensionUi,
	View,
} from '@gizmo/extension-api';
import type { ExtensionViewAddress } from '../AgentClient';
import { fakeConsoleEntries } from './fixtures';
import type { FakeClientState } from './state';

/*
 * Extension UI is data, so the demo client can serve a believable catalog
 * without a sidecar: the ids match the seeded project integrations, so
 * enabling and disabling them in Configure adds and removes tabs exactly as
 * the real ones do. Views answer with their content and then push one
 * `extension.view.updated`, which is the only part of the transport the app
 * cannot exercise from a plain response.
 */

const consoleErrors = fakeConsoleEntries.filter(
	({ level }) => level === 'error',
).length;

const catalog: ExtensionUi[] = [
	{
		id: 'unity',
		name: 'Unity',
		views: [
			{
				id: 'console',
				label: 'Console',
				scope: 'workspace',
				placement: 'inspector',
			},
		],
		statusItems: [
			{
				id: 'unity.play',
				label: 'Edit mode',
				tone: 'accent',
				icon: 'plug-zap',
				view: 'console',
			},
		],
		commands: [
			{ id: 'unity.console', label: 'Unity: Open console', view: 'console' },
			{ id: 'unity.recompile', label: 'Unity: Recompile scripts' },
		],
		settings: [
			{
				kind: 'boolean',
				key: 'autoRefresh',
				label: 'Refresh assets on save',
			},
		],
		toolPresentation: {
			labels: { unity_console: 'Unity console' },
			icons: { unity_console: 'plug-zap' },
		},
		hasProjectService: true,
	},
	{
		id: 'git',
		name: 'Git',
		views: [
			{
				id: 'changes',
				label: 'Changes',
				scope: 'workspace',
				placement: 'inspector',
			},
		],
		statusItems: [],
		commands: [],
		settings: [],
		toolPresentation: {},
		hasProjectService: false,
	},
	{
		id: 'svelte',
		name: 'Svelte',
		views: [
			{ id: 'docs', label: 'Docs', scope: 'workspace', placement: 'inspector' },
		],
		statusItems: [],
		commands: [],
		settings: [],
		toolPresentation: {},
		hasProjectService: false,
	},
];

function consoleView(): View {
	return {
		title: 'Console',
		status: consoleErrors ? 'error' : 'idle',
		badge: consoleErrors,
		badgeTone: 'danger',
		blocks: [
			{
				type: 'log',
				id: 'console',
				follow: true,
				lines: fakeConsoleEntries.map((entry) => ({
					text: entry.message,
					tone:
						entry.level === 'error'
							? 'error'
							: entry.level === 'warn'
								? 'warning'
								: 'default',
				})),
			},
		],
		actions: [{ id: 'clear', label: 'Clear', tone: 'default' }],
	};
}

function changesView(): View {
	return {
		title: 'Changes',
		blocks: [
			{
				type: 'table',
				id: 'files',
				columns: [
					{ id: 'path', label: 'File' },
					{ id: 'state', label: 'State', align: 'end' },
				],
				rows: [
					{
						id: 'player',
						cells: { path: 'Assets/Scripts/Player.cs', state: 'M' },
						path: 'Assets/Scripts/Player.cs',
					},
				],
				empty: 'The working tree is clean.',
			},
		],
		actions: [
			{
				id: 'open',
				label: 'Open file',
				selection: { blockId: 'files', required: true },
				intent: {
					kind: 'openFile',
					target: { kind: 'selection', blockId: 'files' },
				},
			},
		],
	};
}

function docsView(): View {
	return {
		title: 'Docs',
		blocks: [
			{ type: 'heading', text: 'Svelte 5', level: 2 },
			{ type: 'markdown', markdown: 'Runes replace `export let`.' },
		],
	};
}

const views: Record<string, () => View> = {
	'unity/console': consoleView,
	'git/changes': changesView,
	'svelte/docs': docsView,
};

export class FakeExtensionUiCapability {
	constructor(private readonly state: FakeClientState) {}

	async list(projectPath: string): Promise<ExtensionUi[]> {
		this.state.assertProject(projectPath);
		return catalog.map((entry) => structuredClone(entry));
	}

	async open(address: ExtensionViewAddress): Promise<View | undefined> {
		const build = views[`${address.extensionId}/${address.viewId}`];
		if (!build) throw new Error(`Unknown view: ${address.viewId}`);
		const view = build();
		// One push, so the update path is exercised without a running clock.
		setTimeout(() => {
			this.state.emit({
				type: 'extension.view.updated',
				// Every event carries an envelope session; a view's own scope
				// rides along separately as `viewSessionId`.
				sessionId: address.sessionId ?? 'fake-session',
				projectPath: address.projectPath,
				extensionId: address.extensionId,
				viewId: address.viewId,
				...(address.sessionId ? { viewSessionId: address.sessionId } : {}),
				view: build(),
			});
		}, this.state.latencyMs);
		return view;
	}

	async close(): Promise<void> {}

	async action(
		_address: ExtensionViewAddress,
		event: ActionEvent,
	): Promise<ActionResult> {
		return event.cancelled
			? { status: 'rejected' }
			: { status: 'succeeded', message: `Ran ${event.actionId}` };
	}

	async runCommand(): Promise<void> {}
}
