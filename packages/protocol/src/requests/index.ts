import { Type, type Static } from 'typebox';
import { appRequestSchemas } from './app';
import { extensionUiRequestSchemas } from './extension-ui';
import { gitRequestSchemas } from './git';
import { memoryRequestSchemas } from './memory';
import { projectRequestSchemas } from './project';
import { resourcesRequestSchemas } from './resources';
import { sessionRequestSchemas } from './session';

export const agentRequestSchema = Type.Union([
	...sessionRequestSchemas,
	...projectRequestSchemas,
	...extensionUiRequestSchemas,
	...resourcesRequestSchemas,
	...gitRequestSchemas,
	...memoryRequestSchemas,
	...appRequestSchemas,
]);

export type AgentRequest = Static<typeof agentRequestSchema>;
