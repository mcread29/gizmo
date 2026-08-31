import { Type, type Static } from 'typebox';

export const fileRevertResultSchema = Type.Object(
	{
		file: Type.String({ minLength: 1 }),
		reverted: Type.Boolean(),
		reason: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type FileRevertResult = Static<typeof fileRevertResultSchema>;

export const gitFileStatusSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		originalPath: Type.Optional(Type.String({ minLength: 1 })),
		index: Type.String({ minLength: 1, maxLength: 1 }),
		workingTree: Type.String({ minLength: 1, maxLength: 1 }),
	},
	{ additionalProperties: false },
);

export type GitFileStatus = Static<typeof gitFileStatusSchema>;

export const gitStatusSchema = Type.Object(
	{
		rootPath: Type.String({ minLength: 1 }),
		branch: Type.String({ minLength: 1 }),
		clean: Type.Boolean(),
		files: Type.Array(gitFileStatusSchema),
	},
	{ additionalProperties: false },
);

export type GitStatus = Static<typeof gitStatusSchema>;

export const gitCommitResultSchema = Type.Object(
	{
		rootPath: Type.String({ minLength: 1 }),
		commit: Type.String({ minLength: 1 }),
		message: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export type GitCommitResult = Static<typeof gitCommitResultSchema>;
