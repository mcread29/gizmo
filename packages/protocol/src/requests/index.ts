import { Type, type Static } from 'typebox';
import { gitRequestSchemas } from './git';
import { memoryRequestSchemas } from './memory';
import { projectRequestSchemas } from './project';
import { resourcesRequestSchemas } from './resources';
import { sessionRequestSchemas } from './session';

export const agentRequestSchema = Type.Union([
	...sessionRequestSchemas,
	...projectRequestSchemas,
	...resourcesRequestSchemas,
	...gitRequestSchemas,
	...memoryRequestSchemas,
]);

export type AgentRequest = Static<typeof agentRequestSchema>;
