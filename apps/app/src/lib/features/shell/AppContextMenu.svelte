<script lang="ts">
	import { ContextMenu } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type ContextKind =
		'shell' | 'thread' | 'message' | 'tool' | 'composer' | 'unity';

	interface ContextTarget {
		kind: ContextKind;
		id?: string;
		value?: string;
		label?: string;
	}

	interface Props {
		children: Snippet;
		leftVisible: boolean;
		rightVisible: boolean;
		darkTheme: boolean;
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
		onExportTranscript: (sessionId: string) => void;
		onDeleteThread: (sessionId: string) => void;
		onOpenEditor: () => void;
		onRefreshEditor: () => void;
		onToggleLeft: () => void;
		onToggleRight: () => void;
		onToggleTheme: () => void;
		onOpenSettings: () => void;
	}

	let {
		children,
		leftVisible,
		rightVisible,
		darkTheme,
		activeThreadId,
		canDeleteThread,
		canOpenEditor,
		getContextText,
		onNewThread,
		onOpenThread,
		onRenameThread,
		onExportTranscript,
		onDeleteThread,
		onOpenEditor,
		onRefreshEditor,
		onToggleLeft,
		onToggleRight,
		onToggleTheme,
		onOpenSettings,
	}: Props = $props();

	let target = $state<ContextTarget>({ kind: 'shell' });
	let editableTarget = $state<
		HTMLInputElement | HTMLTextAreaElement | undefined
	>();
	let selectedText = $state('');
	let contextText = $derived(
		(target.kind === 'message' || target.kind === 'tool') && target.id
			? getContextText(target.kind, target.id)
			: undefined,
	);

	function captureContext(event: MouseEvent) {
		const eventTarget = event.target;
		editableTarget =
			eventTarget instanceof HTMLInputElement ||
			eventTarget instanceof HTMLTextAreaElement
				? eventTarget
				: undefined;
		selectedText = editableTarget
			? editableTarget.value.slice(
					editableTarget.selectionStart ?? 0,
					editableTarget.selectionEnd ?? 0,
				)
			: (window.getSelection()?.toString() ?? '');

		const contextElement =
			eventTarget instanceof Element
				? eventTarget.closest<HTMLElement>('[data-context-kind]')
				: undefined;
		const kind = contextKind(contextElement?.dataset.contextKind);
		target = {
			kind,
			...(contextElement?.dataset.contextId
				? { id: contextElement.dataset.contextId }
				: {}),
			...(contextElement?.dataset.contextValue
				? { value: contextElement.dataset.contextValue }
				: {}),
			...(contextElement?.dataset.contextLabel
				? { label: contextElement.dataset.contextLabel }
				: {}),
		};
	}

	async function copy(text: string | undefined) {
		if (!text || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard permissions can be denied outside a secure browser context.
		}
	}

	async function paste() {
		if (!editableTarget || !navigator.clipboard) return;
		try {
			const text = await navigator.clipboard.readText();
			const start =
				editableTarget.selectionStart ?? editableTarget.value.length;
			const end = editableTarget.selectionEnd ?? start;
			editableTarget.setRangeText(text, start, end, 'end');
			editableTarget.dispatchEvent(new InputEvent('input', { bubbles: true }));
		} catch {
			// Clipboard permissions can be denied outside a secure browser context.
		}
	}

	function selectAll() {
		editableTarget?.select();
	}

	function contextKind(value: string | undefined): ContextKind {
		switch (value) {
			case 'thread':
			case 'message':
			case 'tool':
			case 'composer':
			case 'unity':
				return value;
			default:
				return 'shell';
		}
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger
		data-ui="context-menu-region"
		oncontextmenu={captureContext}
	>
		{@render children()}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content data-ui="menu-content" data-menu="app-context">
			{#if editableTarget || selectedText}
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!selectedText}
					onSelect={() => void copy(selectedText)}
					>Copy selection</ContextMenu.Item
				>
				{#if editableTarget}
					<ContextMenu.Item data-ui="menu-item" onSelect={() => void paste()}
						>Paste</ContextMenu.Item
					>
					<ContextMenu.Item data-ui="menu-item" onSelect={selectAll}
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
					onSelect={() => void copy(contextText)}
					>Copy {target.label ?? 'message'}</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{:else if target.kind === 'tool'}
				<ContextMenu.Item
					data-ui="menu-item"
					disabled={!contextText}
					onSelect={() => void copy(contextText)}
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
					onSelect={() => void copy(target.value)}
					>Copy project path</ContextMenu.Item
				>
				<ContextMenu.Separator data-ui="menu-separator" />
			{/if}

			<ContextMenu.Item data-ui="menu-item" onSelect={onNewThread}
				>New thread</ContextMenu.Item
			>
			<ContextMenu.Item data-ui="menu-item" onSelect={onToggleLeft}
				>{leftVisible ? 'Hide' : 'Show'} threads</ContextMenu.Item
			>
			<ContextMenu.Item data-ui="menu-item" onSelect={onToggleRight}
				>{rightVisible ? 'Hide' : 'Show'} inspector</ContextMenu.Item
			>
			<ContextMenu.Item data-ui="menu-item" onSelect={onToggleTheme}
				>Use {darkTheme ? 'light' : 'dark'} theme</ContextMenu.Item
			>

			<ContextMenu.Separator data-ui="menu-separator" />
			<ContextMenu.Item data-ui="menu-item" onSelect={onOpenSettings}
				>Settings</ContextMenu.Item
			>
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
