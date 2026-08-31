import { Type, type Static } from 'typebox';
import { gitRequestSchemas } from './git';
import { projectRequestSchemas } from './project';
import { resourcesRequestSchemas } from './resources';
import { sessionRequestSchemas } from './session';

export const agentRequestSchema = Type.Union([
	...sessionRequestSchemas,
	...projectRequestSchemas,
	...resourcesRequestSchemas,
	...gitRequestSchemas,
]);

export type AgentRequest = Static<typeof agentRequestSchema>;
