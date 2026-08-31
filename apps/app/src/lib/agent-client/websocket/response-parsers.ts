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

function isRecord(input: unknown): input is Record<string, unknown> {
	return input !== null && typeof input === 'object';
}
