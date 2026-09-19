<script lang="ts">
	import type { TreeNode } from '@gizmo/extension-api';
	import { extensionIcon, hasExtensionIcon } from '../icons';

	let { node }: { node: TreeNode } = $props();

	let Icon = $derived(extensionIcon(node.icon));
</script>

<!-- What a row says, drawn the same whether the node is a folder or a leaf. -->
{#if hasExtensionIcon(node.icon)}
	<Icon data-ui="view-row-icon" size={13} aria-hidden="true" />
{/if}
<span data-ui="view-row-label">{node.label}</span>
{#if node.detail}<small data-ui="view-row-detail">{node.detail}</small>{/if}
{#if node.badge}<span data-ui="view-row-badge" data-tone={node.badge.tone}
		>{node.badge.text}</span
	>{/if}
