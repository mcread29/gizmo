import { Type, type Static } from 'typebox';
import { eventEnvelope } from './envelopes';

export const compactionPolicySchema = Type.Object(
	{
		enabled: Type.Boolean(),
		fillPercent: Type.Integer({ minimum: 10, maximum: 95 }),
		retainPercent: Type.Integer({ minimum: 0, maximum: 90 }),
	},
	{ additionalProperties: false },
);

export type CompactionPolicy = Static<typeof compactionPolicySchema>;

/**
 * What a workspace compacts under until its config says otherwise. Retaining
 * nothing lets a cut land inside the turn that crossed the threshold.
 */
export const defaultCompactionPolicy: CompactionPolicy = {
	enabled: true,
	fillPercent: 60,
	retainPercent: 0,
};

/** A workspace's compaction policy changed; every client re-reads it. */
export const projectCompactionChangedEventSchema = Type.Object(
	{
		...eventEnvelope,
		type: Type.Literal('project.compaction.changed'),
		projectPath: Type.String({ minLength: 1 }),
		compaction: compactionPolicySchema,
	},
	{ additionalProperties: false },
);
