import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { AgentAttachment } from '@gizmo/protocol';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
	storedAttachmentId,
	storedAttachments,
	type StoredAttachment,
} from './attachment-message';

export interface PiImage {
	type: 'image';
	data: string;
	mimeType: string;
}

export interface PreparedAttachments {
	files: StoredAttachment[];
	images: PiImage[];
}

const modelImageMimeTypes = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
]);

const maxFileBytes = 10 * 1024 * 1024;
const maxTotalBytes = 20 * 1024 * 1024;

export async function prepareAttachments(
	manager: SessionManager,
	attachments: AgentAttachment[],
): Promise<PreparedAttachments> {
	if (!attachments.length) return { files: [], images: [] };
	const directory = attachmentDirectory(manager);
	await mkdir(directory, { recursive: true });
	const files: StoredAttachment[] = [];
	const images: PiImage[] = [];
	let totalBytes = 0;

	for (const attachment of attachments) {
		if (!validBase64(attachment.data)) {
			throw new Error(`Invalid attachment data: ${attachment.name}`);
		}
		const bytes = Buffer.from(attachment.data, 'base64');
		totalBytes += bytes.byteLength;
		if (bytes.byteLength > maxFileBytes || totalBytes > maxTotalBytes) {
			throw new Error(
				'Attachments exceed the 10 MB per-file or 20 MB total limit',
			);
		}
		const id = randomUUID();
		const path = join(directory, `${id}-${safeFileName(attachment.name)}`);
		await writeFile(path, bytes, { flag: 'wx' });
		files.push({
			id,
			name: attachment.name,
			mimeType: attachment.mimeType,
			size: bytes.byteLength,
			path,
		});
		if (modelImageMimeTypes.has(attachment.mimeType)) {
			images.push({
				type: 'image',
				data: attachment.data,
				mimeType: attachment.mimeType,
			});
		}
	}
	return { files, images };
}

export async function readStoredAttachment(
	manager: SessionManager,
	attachmentId: string,
): Promise<{ name: string; mimeType: string; data: string }> {
	const attachment = findStoredAttachment(manager, attachmentId);
	return {
		name: attachment.name,
		mimeType: attachment.mimeType,
		data: (await readFile(attachment.path)).toString('base64'),
	};
}

export async function revealStoredAttachment(
	manager: SessionManager,
	attachmentId: string,
): Promise<void> {
	const attachment = findStoredAttachment(manager, attachmentId);
	const command =
		platform() === 'darwin'
			? (['open', ['-R', attachment.path]] as const)
			: platform() === 'win32'
				? (['explorer.exe', ['/select,', attachment.path]] as const)
				: (['xdg-open', [dirname(attachment.path)]] as const);
	await new Promise<void>((resolvePromise, reject) => {
		const child = spawn(command[0], command[1], {
			detached: true,
			stdio: 'ignore',
		});
		child.once('error', reject);
		child.once('spawn', () => {
			child.unref();
			resolvePromise();
		});
	});
}

function findStoredAttachment(
	manager: SessionManager,
	attachmentId: string,
): StoredAttachment {
	const directory = attachmentDirectory(manager);
	for (const entry of manager.getBranch()) {
		if (entry.type !== 'message') continue;
		const message = (
			entry as { message?: { role?: string; content?: unknown } }
		).message;
		if (message?.role !== 'user') continue;
		const attachment = storedAttachments(message.content).find(
			(item) => storedAttachmentId(item) === attachmentId,
		);
		if (!attachment) continue;
		const filePath = resolve(attachment.path);
		const childPath = relative(directory, filePath);
		if (childPath && !childPath.startsWith('..') && !isAbsolute(childPath)) {
			return attachment;
		}
		break;
	}
	throw new Error('Attachment not found in this session');
}

function attachmentDirectory(manager: SessionManager): string {
	return resolve(
		manager.getSessionDir(),
		'attachments',
		manager.getSessionId(),
	);
}

function safeFileName(name: string): string {
	const safe = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '');
	return safe || 'attachment';
}

function validBase64(value: string): boolean {
	return value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}
