import type { ConversationAttachment } from '@gizmo/protocol';

const manifestStart = '<unity-agent-attachments>';
const manifestEnd = '</unity-agent-attachments>';

export interface StoredAttachment {
	id?: string;
	name: string;
	mimeType: string;
	size: number;
	path: string;
}

export function attachmentPrompt(
	text: string,
	attachments: StoredAttachment[],
): string {
	if (!attachments.length) return text;
	return `${text}\n\n${manifestStart}\n${JSON.stringify(attachments)}\n${manifestEnd}`;
}

export function displayedUserMessage(content: unknown): {
	text: string;
	attachments: ConversationAttachment[];
} {
	const text = textContent(content);
	const start = text.lastIndexOf(`\n\n${manifestStart}\n`);
	if (start < 0 || !text.endsWith(`\n${manifestEnd}`)) {
		return { text, attachments: [] };
	}
	const jsonStart = start + manifestStart.length + 3;
	const jsonEnd = text.length - manifestEnd.length - 1;
	try {
		const manifest = JSON.parse(text.slice(jsonStart, jsonEnd));
		if (!Array.isArray(manifest)) return { text, attachments: [] };
		const images = imageContent(content);
		let imageIndex = 0;
		const attachments = manifest.flatMap((item): ConversationAttachment[] => {
			if (!validManifestItem(item)) return [];
			const attachment: ConversationAttachment = {
				id: storedAttachmentId(item),
				name: item.name,
				mimeType: item.mimeType,
				size: item.size,
			};
			if (item.mimeType.startsWith('image/')) {
				const image = images[imageIndex++];
				if (image?.mimeType === item.mimeType) attachment.data = image.data;
			}
			return [attachment];
		});
		return { text: text.slice(0, start), attachments };
	} catch {
		return { text, attachments: [] };
	}
}

export function storedAttachments(content: unknown): StoredAttachment[] {
	const text = textContent(content);
	const start = text.lastIndexOf(`\n\n${manifestStart}\n`);
	if (start < 0 || !text.endsWith(`\n${manifestEnd}`)) return [];
	const jsonStart = start + manifestStart.length + 3;
	const jsonEnd = text.length - manifestEnd.length - 1;
	try {
		const manifest = JSON.parse(text.slice(jsonStart, jsonEnd));
		return Array.isArray(manifest) ? manifest.filter(validManifestItem) : [];
	} catch {
		return [];
	}
}

export function storedAttachmentId(attachment: StoredAttachment): string {
	return attachment.id || attachment.path.split(/[\\/]/).at(-1) || '';
}

function validManifestItem(value: unknown): value is StoredAttachment {
	if (!value || typeof value !== 'object') return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.name === 'string' &&
		typeof item.mimeType === 'string' &&
		typeof item.size === 'number' &&
		Number.isInteger(item.size) &&
		typeof item.path === 'string'
	);
}

function textContent(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.flatMap((item) =>
			item &&
			typeof item === 'object' &&
			'type' in item &&
			item.type === 'text' &&
			'text' in item &&
			typeof item.text === 'string'
				? [item.text]
				: [],
		)
		.join('');
}

function imageContent(
	content: unknown,
): Array<{ data: string; mimeType: string }> {
	if (!Array.isArray(content)) return [];
	return content.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const image = item as Record<string, unknown>;
		return image.type === 'image' &&
			typeof image.data === 'string' &&
			typeof image.mimeType === 'string'
			? [{ data: image.data, mimeType: image.mimeType }]
			: [];
	});
}
