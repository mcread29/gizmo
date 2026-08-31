import { describe, expect, it } from 'vitest';
import {
	attachmentSize,
	readAttachments,
} from '../../../../src/lib/features/conversation/attachments';

describe('composer attachments', () => {
	it('reads browser files into transport-safe base64', async () => {
		const file = {
			name: 'notes.txt',
			type: 'text/plain',
			size: 5,
			arrayBuffer: async () => new TextEncoder().encode('hello').buffer,
		} as File;

		const [attachment] = await readAttachments([file]);

		expect(attachment).toEqual({
			name: 'notes.txt',
			mimeType: 'text/plain',
			data: 'aGVsbG8=',
		});
		expect(attachmentSize(attachment!)).toBe('5 B');
	});

	it('rejects files larger than the transport limit', async () => {
		const file = {
			name: 'huge.bin',
			type: 'application/octet-stream',
			size: 11 * 1024 * 1024,
			arrayBuffer: async () => new ArrayBuffer(0),
		} as File;

		await expect(readAttachments([file])).rejects.toThrow('larger than 10 MB');
	});
});
