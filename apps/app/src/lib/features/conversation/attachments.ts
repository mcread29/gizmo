import type { AgentAttachment } from '@gizmo/protocol';

export const maxAttachmentCount = 8;
export const maxAttachmentBytes = 10 * 1024 * 1024;

export async function readAttachments(
	files: Iterable<File>,
): Promise<AgentAttachment[]> {
	const selected = Array.from(files);
	if (selected.length > maxAttachmentCount) {
		throw new Error(`Attach at most ${maxAttachmentCount} files at once.`);
	}
	return Promise.all(selected.map(readAttachment));
}

async function readAttachment(file: File): Promise<AgentAttachment> {
	if (file.size > maxAttachmentBytes) {
		throw new Error(`${file.name} is larger than 10 MB.`);
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return {
		name: file.name || 'pasted-file',
		mimeType: file.type || 'application/octet-stream',
		data: btoa(binary),
	};
}

export function attachmentUrl(attachment: AgentAttachment): string {
	return `data:${attachment.mimeType};base64,${attachment.data}`;
}

export function attachmentSize(attachment: AgentAttachment): string {
	const padding = attachment.data.endsWith('==')
		? 2
		: attachment.data.endsWith('=')
			? 1
			: 0;
	const bytes = Math.floor((attachment.data.length * 3) / 4) - padding;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
