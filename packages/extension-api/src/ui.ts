import { Type, type Static } from 'typebox';
import type { ActionEvent, ActionResult, View } from './view';

const strict = { additionalProperties: false };
const identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$',
});
const label = Type.String({ maxLength: 200 });

/**
 * Everything an extension contributes to the UI, as data the host can send
 * to a browser. Views themselves are opened on demand (see `ViewDefinition`);
 * this is the catalog of what exists.
 */

export const viewSummarySchema = Type.Object(
	{
		id: identifier,
		label,
		shortLabel: Type.Optional(label),
		/**
		 * `workspace` views are shared by every client looking at the
		 * workspace; `thread` views are opened per thread and receive its
		 * session id, for extensions that keep per-thread state.
		 */
		scope: Type.Union([Type.Literal('workspace'), Type.Literal('thread')]),
		/** Where the host shows it. `inspector` tabs are the default. */
		placement: Type.Union([Type.Literal('inspector'), Type.Literal('modal')]),
	},
	strict,
);
export type ViewSummary = Static<typeof viewSummarySchema>;

export const statusItemSchema = Type.Object(
	{
		id: identifier,
		label,
		tone: Type.Optional(
			Type.Union([
				Type.Literal('default'),
				Type.Literal('accent'),
				Type.Literal('danger'),
			]),
		),
		/** A lucide icon name the host knows, e.g. `activity`. */
		icon: Type.Optional(label),
		/** Clicking opens this view of the same extension. */
		view: Type.Optional(identifier),
	},
	strict,
);
export type StatusItem = Static<typeof statusItemSchema>;

export const commandSchema = Type.Object(
	{
		id: identifier,
		label,
		keywords: Type.Optional(Type.Array(label, { maxItems: 20 })),
		icon: Type.Optional(label),
		/** Either opens a view of the same extension or runs on the server. */
		view: Type.Optional(identifier),
	},
	strict,
);
export type Command = Static<typeof commandSchema>;

export const settingsFieldSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Literal('text'),
			key: identifier,
			label,
			description: Type.Optional(Type.String({ maxLength: 1_000 })),
			placeholder: Type.Optional(label),
		},
		strict,
	),
	Type.Object(
		{
			kind: Type.Literal('number'),
			key: identifier,
			label,
			description: Type.Optional(Type.String({ maxLength: 1_000 })),
			min: Type.Optional(Type.Number()),
			max: Type.Optional(Type.Number()),
		},
		strict,
	),
	Type.Object(
		{
			kind: Type.Literal('boolean'),
			key: identifier,
			label,
			description: Type.Optional(Type.String({ maxLength: 1_000 })),
		},
		strict,
	),
	Type.Object(
		{
			kind: Type.Literal('select'),
			key: identifier,
			label,
			description: Type.Optional(Type.String({ maxLength: 1_000 })),
			options: Type.Array(Type.Object({ value: label, label }, strict), {
				minItems: 1,
				maxItems: 100,
			}),
		},
		strict,
	),
]);
export type SettingsField = Static<typeof settingsFieldSchema>;

/** How the host labels and trims an extension's tools in the thread. */
export const toolPresentationSchema = Type.Object(
	{
		/** Tool name to human label. */
		labels: Type.Optional(Type.Record(Type.String({ maxLength: 160 }), label)),
		/** Tool name to a lucide icon name the host knows. */
		icons: Type.Optional(Type.Record(Type.String({ maxLength: 160 }), label)),
		/** Tool name to the parameter names worth showing on its card. */
		parameters: Type.Optional(
			Type.Record(
				Type.String({ maxLength: 160 }),
				Type.Array(Type.String({ maxLength: 160 }), { maxItems: 50 }),
			),
		),
	},
	strict,
);
export type ToolPresentation = Static<typeof toolPresentationSchema>;

export const extensionUiSchema = Type.Object(
	{
		id: Type.String({ minLength: 1, maxLength: 128 }),
		name: Type.String({ minLength: 1, maxLength: 128 }),
		views: Type.Array(viewSummarySchema, { maxItems: 50 }),
		statusItems: Type.Array(statusItemSchema, { maxItems: 20 }),
		commands: Type.Array(commandSchema, { maxItems: 100 }),
		settings: Type.Array(settingsFieldSchema, { maxItems: 100 }),
		toolPresentation: toolPresentationSchema,
		/** Whether `project.status`/`project.watch` are worth calling. */
		hasProjectService: Type.Boolean(),
	},
	strict,
);
export type ExtensionUi = Static<typeof extensionUiSchema>;

/** What a view is opened with. */
export interface ViewContext {
	workspacePath: string;
	/** Present for `thread`-scoped views. */
	sessionId?: string;
	/** Replaces what every subscribed client shows. Safe to call often. */
	update(view: View): void;
	/** Values the user set in this extension's settings form (client-local). */
	settings: Readonly<Record<string, unknown>>;
}

export interface ViewHandle {
	/** An action the user ran; absent means the view has none. */
	action?(
		event: ActionEvent,
	): ActionResult | void | Promise<ActionResult | void>;
	dispose(): void | Promise<void>;
}

export interface ViewDefinition {
	label: string;
	shortLabel?: string;
	scope?: 'workspace' | 'thread';
	placement?: 'inspector' | 'modal';
	/**
	 * Called when the first client opens the view; the handle lives until
	 * the last one closes it. Push the first `update` from here.
	 */
	open(context: ViewContext): ViewHandle | Promise<ViewHandle>;
}

/** Given to a static contribution callback. */
export interface UiContext {
	workspacePath: string;
	sessionId?: string;
}

/** What the host hands an extension when it is registered. */
export interface ExtensionHost {
	/**
	 * Tells clients that status items or commands changed and should be
	 * re-fetched. Views push their own updates and never need this.
	 */
	uiChanged(workspacePath?: string): void;
}
