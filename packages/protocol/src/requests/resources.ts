import { Type } from 'typebox';
import { envelope } from '../envelopes';

export const resourcesRequestSchemas = [
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.list'),
			/** Omitted lists global state only. */
			workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.global'),
			skillId: Type.String({ minLength: 1, maxLength: 200 }),
			installed: Type.Optional(Type.Boolean()),
			enabled: Type.Optional(Type.Boolean()),
			workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.read'),
			path: Type.String({ minLength: 1 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.write'),
			path: Type.String({ minLength: 1 }),
			content: Type.String({ maxLength: 1_000_000 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.gizmo-extension.global'),
			gizmoExtensionId: Type.String({ minLength: 1, maxLength: 64 }),
			enabled: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.extension.global'),
			extensionId: Type.String({ minLength: 1, maxLength: 255 }),
			enabled: Type.Boolean(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('resources.skill.project'),
			workspacePath: Type.String({ minLength: 1 }),
			skillId: Type.String({ minLength: 1, maxLength: 200 }),
			/** Null clears the override so the global setting applies again. */
			enabled: Type.Union([Type.Boolean(), Type.Null()]),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.status'),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.add'),
			url: Type.String({ minLength: 1, maxLength: 2_000 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.update'),
			registry: Type.String({ minLength: 1, maxLength: 200 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.remove'),
			registry: Type.String({ minLength: 1, maxLength: 200 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.link'),
			registry: Type.String({ minLength: 1, maxLength: 200 }),
			id: Type.String({ minLength: 1, maxLength: 200 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('registry.unlink'),
			registry: Type.String({ minLength: 1, maxLength: 200 }),
			id: Type.String({ minLength: 1, maxLength: 200 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('tools.policy.get'),
			/** Omitted resolves the default workspace (server cwd). */
			workspacePath: Type.Optional(Type.String({ minLength: 1 })),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('tools.policy.global.set'),
			tools: Type.Array(Type.String()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			...envelope,
			type: Type.Literal('tools.policy.project.set'),
			workspacePath: Type.String({ minLength: 1 }),
			/** Null clears the override so the global setting applies again. */
			tools: Type.Union([Type.Array(Type.String()), Type.Null()]),
		},
		{ additionalProperties: false },
	),
] as const;
