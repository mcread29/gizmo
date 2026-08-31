import type { InstructionFile, InstructionTarget } from '@gizmo/protocol';
import type { SkillFile } from '@gizmo/protocol';
import type { AttachmentContent } from '../AgentClient';

export function parseAttachmentContent(input: unknown): AttachmentContent {
	if (
		!isRecord(input) ||
		typeof input.name !== 'string' ||
		typeof input.mimeType !== 'string' ||
		typeof input.data !== 'string'
	) {
		throw new Error('Agent server returned invalid attachment data');
	}
	return {
		name: input.name,
		mimeType: input.mimeType,
		data: input.data,
	};
}

export function parseSkillFile(input: unknown): SkillFile {
	if (
		!isRecord(input) ||
		typeof input.path !== 'string' ||
		typeof input.content !== 'string'
	) {
		throw new Error('Agent server returned an invalid skill file');
	}
	return { path: input.path, content: input.content };
}

const instructionTargets = [
	'system-prompt',
	'global-agents',
	'project-agents',
] as const;

export function parseInstructionFile(input: unknown): InstructionFile {
	if (
		!isRecord(input) ||
		typeof input.target !== 'string' ||
		!instructionTargets.includes(input.target as InstructionTarget) ||
		typeof input.path !== 'string' ||
		typeof input.content !== 'string' ||
		typeof input.exists !== 'boolean'
	) {
		throw new Error('Agent server returned an invalid instruction file');
	}
	return {
		target: input.target as InstructionTarget,
		path: input.path,
		content: input.content,
		exists: input.exists,
	};
}

function isRecord(input: unknown): input is Record<string, unknown> {
	return input !== null && typeof input === 'object';
}
