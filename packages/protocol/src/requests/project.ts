import { Type } from 'typebox';
import { envelope, v25Envelope } from '../envelopes';

export const projectRequestSchemas = [
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.list'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.detect'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.browse'),
			path: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.search'),
			query: Type.String(),
			root: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.add'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.gizmo-extension.set'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 64 }),
			/** Null clears the override so the global setting applies again. */
			enabled: Type.Union([Type.Boolean(), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.pi-extension.set'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 255 }),
			/** Null clears the override so the global setting applies again. */
			enabled: Type.Union([Type.Boolean(), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.remove'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.reorder'),
			/** Every registered path, in the order the sidebar should show them. */
			paths: Type.Array(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.status'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
		},
		{ additionalProperties: false },
	),
	/** v25 compatibility: no extensionId, first-available service routing. */
	Type.Object(
		{
			...v25Envelope,
			type: Type.Literal('project.status'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.watch'),
			sessionId: Type.String({ minLength: 1 }),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
		},
		{ additionalProperties: false },
	),
	/** v25 compatibility: no extensionId, first-available service routing. */
	Type.Object(
		{
			...v25Envelope,
			type: Type.Literal('project.watch'),
			sessionId: Type.String({ minLength: 1 }),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.open'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
		},
		{ additionalProperties: false },
	),
	/** v25 compatibility: no extensionId, first-available service routing. */
	Type.Object(
		{
			...v25Envelope,
			type: Type.Literal('project.open'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.extensions'),
			projectPath: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('extensions.web'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('project.extension.invoke'),
			projectPath: Type.String({ minLength: 1 }),
			extensionId: Type.String({ minLength: 1, maxLength: 128 }),
			operation: Type.String({ minLength: 1, maxLength: 128 }),
			input: Type.Optional(Type.Unknown()),
		},
		{ additionalProperties: false },
	),
] as const;
