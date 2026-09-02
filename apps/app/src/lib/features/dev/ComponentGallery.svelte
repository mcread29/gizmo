<script lang="ts">
	import { MoreHorizontal, Palette, Trash2 } from '@lucide/svelte';
	import { ToastQueue } from '../../toasts.svelte';
	import {
		Button,
		ConfirmDialog,
		Dialog,
		Menu,
		ScrollPanel,
		SelectField,
		SwitchField,
		Tabs,
		Toast,
		Tooltip,
	} from '../../components';

	let open = $state(false);
	let confirmOpen = $state(false);
	let switchOn = $state(true);
	let selectValue = $state('sonnet');
	let tabValue = $state('controls');

	// A queue of its own so gallery noise never lands in the real workspace.
	const galleryToasts = new ToastQueue();

	const selectOptions = [
		{ value: 'sonnet', label: 'Claude Sonnet', hint: 'anthropic' },
		{ value: 'gpt', label: 'GPT', hint: 'openai' },
		{ value: 'gemini', label: 'Gemini', hint: 'google' },
	];
	const statuses = ['online', 'connecting', 'reconnecting', 'disconnected'];
	const pills = ['connected', 'compiling', 'error'];
	const toolStates = ['running', 'complete', 'error'] as const;
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
				<span>Status</span><code>data-status · data-state</code>
			</div>
			<div data-ui="gallery-row">
				{#each statuses as status (status)}
					<span data-ui="connection-row"
						><span data-ui="status-dot" data-status={status}
						></span>{status}</span
					>
				{/each}
			</div>
			<div data-ui="gallery-row">
				{#each pills as state (state)}
					<span data-ui="status-pill" data-state={state}
						><span></span>{state}</span
					>
				{/each}
			</div>
		</section>

		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Loading and empty</span><code>data-ui="skeleton"</code>
			</div>
			<div data-ui="message-skeleton">
				<div data-ui="skeleton" data-shape="avatar"></div>
				<div>
					<div data-ui="skeleton" data-shape="line"></div>
					<div data-ui="skeleton" data-shape="line" data-width="short"></div>
				</div>
			</div>
			<div data-ui="empty-state">
				<strong>Nothing here yet</strong><span
					>Empty states explain what would appear.</span
				>
			</div>
		</section>

		<section data-ui="gallery-section" data-span="full">
			<div data-ui="gallery-heading">
				<span>Tool call states</span><code>data-state</code>
			</div>
			<div data-ui="inspector-stack">
				{#each toolStates as state (state)}
					<details data-ui="tool-call" data-state={state}>
						<summary data-ui="tool-header">
							<span><strong>Unity command</strong><small>{state}</small></span>
						</summary>
						<div data-ui="tool-content">
							<p data-ui="tool-empty">Result body for the {state} state.</p>
						</div>
					</details>
				{/each}
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
					<ScrollPanel name="gallery">
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
				<span>Fields</span><code>data-ui="switch"</code>
			</div>
			<SwitchField
				bind:checked={switchOn}
				label="A setting"
				description="Switch fields pair a label with an explanation of the effect."
			/>
		</section>

		<section data-ui="gallery-section">
			<div data-ui="gallery-heading">
				<span>Feedback</span><code>aria-live="polite"</code>
			</div>
			<div data-ui="gallery-row">
				<Button
					onclick={() => galleryToasts.show('Editor connection refreshed')}
					>Show toast</Button
				>
				<Button
					variant="danger"
					onclick={() =>
						galleryToasts.show('Could not reach the Editor', 'danger')}
					>Show error toast</Button
				>
				<Button variant="secondary" onclick={() => (confirmOpen = true)}
					>Confirm dialog</Button
				>
			</div>
		</section>
	</div>
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Destructive action?"
	confirmLabel="Do it"
	onConfirm={() => {
		confirmOpen = false;
	}}
>
	<p>Confirmations lead with Cancel and name what is about to be lost.</p>
</ConfirmDialog>

<Toast queue={galleryToasts} />
