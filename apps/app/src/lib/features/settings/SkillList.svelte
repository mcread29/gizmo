<script lang="ts">
	import { MoreHorizontal } from '@lucide/svelte';
	import { Switch } from 'bits-ui';
	import type { SkillResource } from '@gizmo/protocol';
	import { Button, Menu, type MenuItem } from '../../components';

	interface Props {
		skills: SkillResource[];
		/**
		 * `global` edits the installed set and the default for every workspace.
		 * `workspace` overrides that default for one directory.
		 */
		mode: 'global' | 'workspace';
		busy?: boolean;
		/** Skills that depart from what the row's baseline would give. */
		changed?: ReadonlySet<string>;
		/** What resetting a row goes back to; defaults to the global setting. */
		resetLabel?: string;
		onToggle: (skill: SkillResource, enabled: boolean) => void;
		onReset?: (skill: SkillResource) => void;
		onInstall?: (skill: SkillResource, installed: boolean) => void;
	}

	let {
		skills,
		mode,
		busy = false,
		changed,
		resetLabel = 'Use global setting',
		onToggle,
		onReset,
		onInstall,
	}: Props = $props();

	/** A row resets when it overrides the global setting or its baseline. */
	function resettable(skill: SkillResource) {
		return skill.override !== undefined || (changed?.has(skill.id) ?? false);
	}

	function stateLabel(skill: SkillResource) {
		if (!skill.installed) return 'Not installed';
		if (mode === 'global') return skill.enabledGlobally ? 'On' : 'Off';
		if (skill.override !== undefined)
			return skill.override ? 'On here' : 'Off here';
		return skill.enabledGlobally ? 'On' : 'Off';
	}

	function note(skill: SkillResource) {
		if (!skill.installed) return 'Hidden from every workspace';
		if (mode === 'global')
			return skill.enabledGlobally
				? 'Default for every workspace'
				: 'Workspaces can still turn it on';
		return skill.override !== undefined
			? 'Overrides the default'
			: skill.enabledGlobally
				? 'On by default'
				: 'Off by default';
	}

	function menuItems(skill: SkillResource): MenuItem[] {
		const items: MenuItem[] = [];
		if (mode === 'workspace' && resettable(skill) && onReset) {
			items.push({
				label: resetLabel,
				onSelect: () => onReset(skill),
			});
		}
		if (mode === 'global' && onInstall) {
			items.push(
				skill.installed
					? {
							label: 'Uninstall',
							tone: 'danger',
							onSelect: () => onInstall(skill, false),
						}
					: { label: 'Install', onSelect: () => onInstall(skill, true) },
			);
		}
		return items;
	}
</script>

{#if skills.length === 0}
	<p data-ui="resource-empty">No skills match.</p>
{:else}
	<div data-ui="skill-list">
		{#each skills as skill (skill.id)}
			{@const items = menuItems(skill)}
			<div
				data-ui="skill-row"
				data-state={skill.installed ? 'installed' : 'uninstalled'}
				data-changed={changed?.has(skill.id) || undefined}
			>
				<div data-ui="skill-row-main">
					<div data-ui="skill-row-title">
						<strong>{skill.name}</strong>
						<em data-ui="resource-scope">{skill.scope}</em>
						<span data-ui="skill-row-state" data-on={skill.enabled}
							>{stateLabel(skill)}</span
						>
					</div>
					{#if skill.description}
						<p data-ui="skill-row-description">{skill.description}</p>
					{/if}
					<small data-ui="resource-detail">{note(skill)}</small>
				</div>
				<div data-ui="skill-row-actions">
					<Switch.Root
						data-ui="switch"
						checked={mode === 'global' ? skill.enabledGlobally : skill.enabled}
						disabled={busy || !skill.installed}
						aria-label={`${skill.name} enabled`}
						onCheckedChange={(value) => onToggle(skill, value)}
					>
						<Switch.Thumb data-ui="switch-thumb" />
					</Switch.Root>
					{#if items.length}
						<Menu {items}>
							{#snippet trigger(props)}
								<Button
									{...props}
									variant="ghost"
									size="icon"
									aria-label={`${skill.name} options`}
									><MoreHorizontal size={16} /></Button
								>
							{/snippet}
						</Menu>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
