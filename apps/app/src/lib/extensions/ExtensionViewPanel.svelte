<script lang="ts">
	import type { ActionEvent, View } from '@gizmo/extension-api';
	import { untrack } from 'svelte';
	import type { AgentStore } from '../agent-client';
	import { toasts } from '../toasts.svelte';
	import { appIntentHost } from './view/intents';
	import ViewRenderer from './view/ViewRenderer.svelte';

	let {
		store,
		projectPath,
		extensionId,
		viewId,
		sessionId,
		settings,
		onViewChange,
	}: {
		store: AgentStore;
		projectPath: string;
		extensionId: string;
		viewId: string;
		/** Passed for thread-scoped views; the server ignores it otherwise. */
		sessionId?: string;
		/** The extension's client-local settings values, sent on open. */
		settings?: Record<string, unknown>;
		/** Lets a tab show the view's badge without opening it twice. */
		onViewChange?: (view: View | undefined) => void;
	} = $props();

	let view = $state<View>();
	let error = $state<string>();
	/** Bumped by a reload so the effect reopens the view on new code. */
	let reloadToken = $state(0);

	let address = $derived({
		projectPath,
		extensionId,
		viewId,
		...(sessionId ? { sessionId } : {}),
	});
	let host = $derived(
		appIntentHost(projectPath, (id) => void store.switchSession(id)),
	);

	$effect(() => {
		const unsubscribe = store.client.subscribe((event) => {
			if (typeof event !== 'object' || event === null || !('type' in event))
				return;
			const message = event as {
				type: string;
				projectPath?: string;
				extensionId?: string;
				viewId?: string;
				viewSessionId?: string;
				view?: View;
			};
			if (message.type === 'extensions.reloaded') {
				reloadToken++;
				return;
			}
			if (
				message.type !== 'extension.view.updated' ||
				message.projectPath !== projectPath ||
				message.extensionId !== extensionId ||
				message.viewId !== viewId
			)
				return;
			// A workspace-scoped view carries no session; a thread-scoped one
			// must match the thread this panel was opened for.
			if (message.viewSessionId && message.viewSessionId !== sessionId) return;
			view = message.view;
		});
		return unsubscribe;
	});

	$effect(() => {
		const open = { ...address };
		reloadToken;
		// Settings are a snapshot taken at open: reading them reactively would
		// reopen the view on every keystroke in the settings form.
		const values = untrack(() => (settings ? { ...settings } : undefined));
		let live = true;
		view = undefined;
		error = undefined;
		store.client
			.openExtensionView(open, values)
			.then((opened) => {
				if (live && opened) view = opened;
			})
			.catch((reason) => {
				if (live)
					error = reason instanceof Error ? reason.message : String(reason);
			});
		return () => {
			live = false;
			void store.client.closeExtensionView(open).catch(() => {});
		};
	});

	$effect(() => {
		const latest = view;
		untrack(() => onViewChange?.(latest));
	});

	async function run(event: ActionEvent) {
		try {
			const result = await store.client.runExtensionViewAction(address, event);
			if (result.status === 'succeeded') {
				if (result.message) toasts.show(result.message);
				return;
			}
			toasts.show(
				result.message ?? `The action was ${result.status}`,
				result.status === 'failed' ? 'danger' : 'warning',
			);
		} catch (reason) {
			toasts.show(
				reason instanceof Error ? reason.message : String(reason),
				'danger',
			);
		}
	}
</script>

<div data-ui="view-panel">
	<div data-ui="view-panel-header">
		<h3>{view?.title ?? 'Loading…'}</h3>
		{#if view?.status}
			<span data-ui="view-panel-status" data-status={view.status}
				>{view.status}</span
			>
		{/if}
	</div>
	{#if error}
		<p data-ui="view-panel-error">{error}</p>
	{:else if view}
		<ViewRenderer {view} {projectPath} {host} onAction={run} />
	{/if}
</div>
