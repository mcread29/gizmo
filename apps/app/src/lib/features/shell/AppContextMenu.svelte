<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import {
		copyText,
		pasteInto,
		readContextTarget,
		type ContextTarget,
	} from './context-target';
	import type { WorkspaceLayout } from './workspace.svelte';

	interface Props {
		children: Snippet;
		layout: WorkspaceLayout;
		activeThreadId?: string;
		canDeleteThread: boolean;
		canOpenEditor: boolean;
		getContextText: (
			kind: 'message' | 'tool',
			id: string,
		) => string | undefined;
		onNewThread: () => void;
		onOpenThread: (sessionId: string) => void;
		onRenameThread: (sessionId: string) => void;
		onCopyTranscript: (sessionId: string) => void;
		onExportTranscript: (sessionId: string) => void;
		onDeleteThread: (sessionId: string) => void;
		onOpenEditor: () => void;
		onRefreshEditor: () => void;
		onOpenSettings: () => void;
	}

	let {
		children,
		layout,
		activeThreadId,
		canDeleteThread,
		canOpenEditor,
		getContextText,
		onNewThread,
		onOpenThread,
		onRenameThread,
		onCopyTranscript,
		onExportTranscript,
		onDeleteThread,
		onOpenEditor,
		onRefreshEditor,
		onOpenSettings,
	}: Props = $props();

	let target = $state<ContextTarget>({ kind: 'shell', selectedText: '' });
	let contextText = $derived(
		(target.kind === 'message' || target.kind === 'tool') && target.id
			? getContextText(target.kind, target.id)
			: undefined,
	);
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger
		data-ui="context-menu-region"
		oncontextmenu={(event: MouseEvent) => (target = readContextTarget(event))}
	>
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content data-ui="menu-content" data-menu="app-context">
			{#if target.editable || target.selectedText}
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!target.selectedText}
					onSelect={() => void copyText(target.selectedText)}
					>Copy selection</ContextMenu.Item
				>
				{#if target.editable}
					<ContextMenu.Item
						data-ui="menu-item"
						onSelect={() => void pasteInto(target.editable)}
						>Paste</ContextMenu.Item
					>
					<ContextMenu.Item
						data-ui="menu-item"
						onSelect={() => target.editable?.select()}
						>Select all</ContextMenu.Item
					>
				{/if}
				<ContextMenu.Separator data-ui="menu-separator" />
			{/if}

			{#if target.kind === 'thread' && target.id}
				{#if target.id !== activeThreadId}
					<ContextMenu.Item
						data-ui="menu-item"
						onSelect={() => onOpenThread(target.id!)}
						>Open thread</ContextMenu.Item
					>
				{/if}
				<ContextMenu.Item
					data-ui="menu-item"
					onSelect={() => onRenameThread(target.id!)}
					>Rename thread</ContextMenu.Item
				>
				<ContextMenu.Item
					data-ui="menu-item"
					onSelect={() => onCopyTranscript(target.id!)}
					>Copy transcript</ContextMenu.Item
				>
				<ContextMenu.Item
					data-ui="menu-item"
					onSelect={() => onExportTranscript(target.id!)}
					>Export transcript</ContextMenu.Item
				>
				<ContextMenu.Item
					data-ui="menu-item"
					data-tone="danger"
					disabled={!canDeleteThread}
					onSelect={() => onDeleteThread(target.id!)}
					>Delete thread</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{:else if target.kind === 'message'}
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!contextText}
					onSelect={() => void copyText(contextText)}
					>Copy {target.label ?? 'message'}</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{:else if target.kind === 'tool'}
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!contextText}
					onSelect={() => void copyText(contextText)}
					>Copy tool output</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{:else if target.kind === 'unity'}
				{#if canOpenEditor}
					<ContextMenu.Item data-ui="menu-item" onSelect={onOpenEditor}
						>Open Editor</ContextMenu.Item
					>
				{/if}
				<ContextMenu.Item data-ui="menu-item" onSelect={onRefreshEditor}
					>Refresh Editor status</ContextMenu.Item
				>
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!target.value}
					onSelect={() => void copyText(target.value)}
					>Copy project path</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{/if}

			<ContextMenu.Item data-ui="menu-item" onSelect={onNewThread}
				>New thread</ContextMenu.Item
			>
			<ContextMenu.Item data-ui="menu-item" onSelect={() => layout.toggleLeft()}
				>{layout.leftVisible ? 'Hide' : 'Show'} threads</ContextMenu.Item
			>
			<ContextMenu.Item
				data-ui="menu-item"
				onSelect={() => layout.toggleRight()}
				>{layout.rightVisible ? 'Hide' : 'Show'} inspector</ContextMenu.Item
			>
			<ContextMenu.Item
				data-ui="menu-item"
				onSelect={() => layout.toggleTheme()}
				>Use {layout.darkTheme ? 'light' : 'dark'} theme</ContextMenu.Item
			>

			<ContextMenu.Separator data-ui="menu-separator" />
			<ContextMenu.Item data-ui="menu-item" onSelect={onOpenSettings}
				>Settings</ContextMenu.Item
			>
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
