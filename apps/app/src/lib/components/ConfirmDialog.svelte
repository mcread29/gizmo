<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		cancelLabel = 'Cancel',
		tone = 'danger',
		children,
		onConfirm,
		onCancel,
	}: {
		open?: boolean;
		title: string;
		description?: string;
		confirmLabel: string;
		cancelLabel?: string;
		tone?: 'danger' | 'primary';
		children?: Snippet;
		onConfirm: () => void | Promise<void>;
		onCancel?: () => void | Promise<void>;
	} = $props();

	let wasOpen = false;
	let confirming = false;
	$effect(() => {
		if (open) wasOpen = true;
		else if (wasOpen && !confirming) {
			wasOpen = false;
			void onCancel?.();
		}
	});

	async function confirm() {
		confirming = true;
		await onConfirm();
		wasOpen = false;
		open = false;
		confirming = false;
	}
</script>

<Dialog bind:open {title} {description}>
	{#if children}<div data-ui="confirm-body">{@render children()}</div>{/if}
	<!-- Cancel comes first and is the default focus target: a modal whose only
	     button is the destructive one is a misclick away from data loss. -->
	<div data-ui="dialog-actions">
		<Button variant="secondary" onclick={() => (open = false)}
			>{cancelLabel}</Button
		>
		<Button variant={tone} onclick={() => void confirm()}>{confirmLabel}</Button
		>
	</div>
</Dialog>
