<script lang="ts">
	import { ArrowDown } from '@lucide/svelte';
	import { Button } from '../../components';

	let {
		visible,
		unreadCount,
		streaming,
		onLatest,
		onUnread,
	}: {
		/** Only offered once the user has scrolled away from the newest text. */
		visible: boolean;
		unreadCount: number;
		streaming: boolean;
		onLatest: () => void;
		onUnread: () => void;
	} = $props();
</script>

{#if visible}
	<div data-ui="jump-to-latest">
		{#if unreadCount > 0}
			<Button variant="primary" size="sm" onclick={onUnread}
				><ArrowDown size={13} />
				{unreadCount === 1
					? '1 new message'
					: `${unreadCount} new messages`}</Button
			>
		{:else}
			<Button variant="secondary" size="sm" onclick={onLatest}
				><ArrowDown size={13} />
				{streaming ? 'New output below' : 'Jump to latest'}</Button
			>
		{/if}
	</div>
{/if}
