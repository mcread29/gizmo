import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/svelte';
import { z } from 'zod';

export const displayProps = {
	Heading: z.object({
		text: z.string(),
		level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
	}),
	Text: z.object({ text: z.string() }),
	Card: z.object({ title: z.string().optional() }),
	Stack: z.object({}),
	List: z.object({ items: z.array(z.string()) }),
	Table: z.object({
		columns: z.array(z.string()),
		rows: z.array(z.array(z.string())),
	}),
	Metric: z.object({
		label: z.string(),
		value: z.string(),
		description: z.string().optional(),
	}),
	Divider: z.object({}),
};

export const displayCatalog = defineCatalog(schema, {
	components: {
		Heading: { props: displayProps.Heading, slots: [], description: 'Heading' },
		Text: { props: displayProps.Text, slots: [], description: 'Plain text' },
		Card: {
			props: displayProps.Card,
			slots: ['default'],
			description: 'Content group',
		},
		Stack: {
			props: displayProps.Stack,
			slots: ['default'],
			description: 'Vertical group',
		},
		List: { props: displayProps.List, slots: [], description: 'Text list' },
		Table: {
			props: displayProps.Table,
			slots: [],
			description: 'Tabular data',
		},
		Metric: {
			props: displayProps.Metric,
			slots: [],
			description: 'Labeled value',
		},
		Divider: {
			props: displayProps.Divider,
			slots: [],
			description: 'Separator',
		},
	},
	actions: {},
});

export type DisplayProps<K extends keyof typeof displayProps> = z.infer<
	(typeof displayProps)[K]
>;
