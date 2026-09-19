import type { Component } from 'svelte';

/**
 * A command the palette can run. Extensions contribute these as data; this is
 * the shape once the host has resolved the icon and decided what running it
 * means (opening a view, or asking the server).
 */
export interface CommandContribution {
	id: string;
	label: string;
	keywords?: string[];
	icon?: Component<any>;
	run(): void;
}
