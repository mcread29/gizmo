<script lang="ts">
	import { MoreHorizontal, Palette, Trash2 } from '@lucide/svelte';
	import {
		Button,
		Dialog,
		Menu,
		ScrollPanel,
		SelectField,
		Tabs,
		Toast,
		Tooltip,
	} from './index';

	let open = $state(false);
	let toastOpen = $state(false);
	let selectValue = $state('sonnet');
	let tabValue = $state('controls');

	const selectOptions = [
		{ value: 'sonnet', label: 'Claude Sonnet' },
		{ value: 'gpt', label: 'GPT' },
		{ value: 'gemini', label: 'Gemini' },
	];
</script>

<Dialog
	bind:open
	title="Interface components"
	description="Interaction and state reference"
	size="lg"
>
	{#snippet trigger(props)}
		<Button {...props} variant="ghost" size="sm"
			><Palette size={15} /> Components</Button
		>
	{/snippet}
	<div data-ui="gallery">
		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Buttons</span><code>data-ui="button"</code>
			</div>
			<div data-ui="gallery-row">
				<Button variant="primary">Primary</Button>
				<Button>Secondary</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="danger"><Trash2 size={14} /> Delete</Button>
				<Button disabled>Disabled</Button>
			</div>
		</section>

		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Menus and selection</span><code>data-state</code>
			</div>
			<div data-ui="gallery-row">
				<Menu
					items={[
						{ label: 'Rename session' },
						{ label: 'Duplicate session' },
						{ label: 'Delete session', tone: 'danger' },
					]}
				>
					{#snippet trigger(props)}
						<Button {...props} size="icon" aria-label="Open example menu"
							><MoreHorizontal size={17} /></Button
						>
					{/snippet}
				</Menu>
				<SelectField
					label="Model"
					options={selectOptions}
					bind:value={selectValue}
				/>
				<Tooltip text="A short, useful explanation">
					{#snippet children(props)}<Button {...props} variant="ghost"
							>Hover for tooltip</Button
						>{/snippet}
				</Tooltip>
			</div>
		</section>

		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Tabs and scrolling</span><code>data-state="active"</code>
			</div>
			<Tabs
				items={[
					{ value: 'controls', label: 'Controls' },
					{ value: 'content', label: 'Content' },
				]}
				bind:value={tabValue}
			>
				{#snippet children(value)}
					<ScrollPanel data-ui="gallery-scroll">
						<p>
							{value === 'controls'
								? 'Tabs expose their selected state through data attributes, while focus remains visible for keyboard users.'
								: 'Scroll areas retain native behavior and add unobtrusive custom scrollbars.'}
						</p>
						<p>
							Every visual primitive is controlled by shared tokens, so light
							and dark themes stay structurally identical.
						</p>
						<p>
							This panel intentionally overflows to show the scroll primitive.
						</p>
					</ScrollPanel>
				{/snippet}
			</Tabs>
		</section>

		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Feedback</span><code>aria-live="polite"</code>
			</div>
			<Button onclick={() => (toastOpen = true)}>Show toast</Button>
		</section>
	</div>
</Dialog>

<Toast bind:open={toastOpen} message="Editor connection refreshed" />
