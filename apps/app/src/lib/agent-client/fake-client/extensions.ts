import type {
	ExtensionUiRequest,
	ExtensionUiResponse,
	GitCommitResult,
	GitStatus,
} from '@gizmo/protocol';
import { fakeConsoleEntries, fakeConsoleExtension } from './fixtures';
import type { FakeClientState } from './state';

export class FakeExtensionCapability {
	constructor(private readonly state: FakeClientState) {}

	async listProjectExtensions() {
		return { extensions: [fakeConsoleExtension] };
	}

	async invoke(
		projectPath: string,
		extensionId: string,
		operation: string,
		input?: unknown,
	) {
		if (extensionId === 'git' && operation === 'status') {
			this.state.assertProject(projectPath);
			const status: GitStatus = {
				rootPath: projectPath,
				branch: 'main',
				clean: false,
				files: [
					{
						path: 'Assets/Scripts/Player.cs',
						index: ' ',
						workingTree: 'M',
					},
				],
			};
			return status;
		}
		if (extensionId === 'git' && operation === 'commit') {
			this.state.assertProject(projectPath);
			const result: GitCommitResult = {
				rootPath: projectPath,
				commit: '0123456789abcdef',
				message: readMessage(input),
			};
			return result;
		}
		if (
			extensionId !== fakeConsoleExtension.id ||
			operation !== 'console.snapshot'
		) {
			throw new Error(
				`Unknown extension operation: ${extensionId}/${operation}`,
			);
		}
		return {
			state: 'ready',
			revision: 'fake-console',
			counts: { logs: 2, warnings: 1, errors: 1 },
			entries: fakeConsoleEntries,
		};
	}

	async revertFile(file: string) {
		return { file, reverted: true };
	}

	emitUi(
		sessionId: string,
		request: ExtensionUiRequest,
		options: { runtimeId?: string; uiRequestId?: string } = {},
	) {
		this.state.emit({
			type: 'extension.ui.requested',
			sessionId,
			runtimeId: options.runtimeId ?? 'fake-runtime',
			uiRequestId: options.uiRequestId ?? this.state.nextId('fake-ui'),
			request,
		});
	}

	async resolveUi(
		sessionId: string,
		runtimeId: string,
		uiRequestId: string,
		response: ExtensionUiResponse,
	) {
		this.state.extensionUiResponses.push({
			sessionId,
			runtimeId,
			uiRequestId,
			response,
		});
	}

	async resolveConfirmation() {}

	async readAttachment(): Promise<never> {
		throw new Error('Attachment data is unavailable in the demo client');
	}

	async revealAttachment() {}
}

function readMessage(input: unknown) {
	if (typeof input !== 'object' || input === null || !('message' in input)) {
		return '';
	}
	return typeof input.message === 'string' ? input.message : '';
}
