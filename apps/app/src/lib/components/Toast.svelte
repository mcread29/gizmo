<script lang="ts">
	import { CheckCircle2, CircleAlert, X } from '@lucide/svelte';
	import Button from './Button.svelte';

	let {
		open = $bindable(false),
		message,
		tone = 'success',
	}: {
		open?: boolean;
		message: string;
		tone?: 'success' | 'danger';
	} = $props();
</script>

{#if open}
	<div data-ui="toast-region" aria-live="polite" aria-atomic="true">
		<div
			data-ui="toast"
			data-tone={tone}
			role={tone === 'danger' ? 'alert' : 'status'}
		>
			<span data-ui="toast-icon">
				{#if tone === 'success'}<CheckCircle2 size={18} />{:else}<CircleAlert
						size={18}
					/>{/if}
			</span>
			<span>{message}</span>
			<Button
				variant="ghost"
				size="icon"
				aria-label="Dismiss notification"
				onclick={() => (open = false)}
			>
				<X size={15} />
			</Button>
		</div>
	</div>
{/if}
