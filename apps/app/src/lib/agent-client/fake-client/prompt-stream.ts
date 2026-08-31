import type { AgentAttachment, CompactionPolicy } from '@gizmo/protocol';
import { fakeEditFile, fakeEditResult } from './fixtures';
import type { FakeSessionCapability } from './sessions';
import type { FakeClientState, FakeSession } from './state';

export class FakePromptCapability {
	constructor(
		private readonly state: FakeClientState,
		private readonly sessions: FakeSessionCapability,
	) {}

	async prompt(
		sessionId: string,
		text: string,
		_compaction?: CompactionPolicy,
		_attachments?: AgentAttachment[],
	) {
		const session = this.state.getSession(sessionId);
		if (session.running) throw new Error('Session is already streaming');

		const abortController = new AbortController();
		session.abortController = abortController;
		session.running = true;
		this.addUserMessage(sessionId, session, text);
		const { message: assistantMessage, id: assistantMessageId } =
			this.addAssistantMessage(sessionId, session);

		try {
			for (const delta of [
				'I’ll inspect the connected Editor, ',
				'then check the active project state.',
			]) {
				if (!(await this.state.wait(abortController.signal))) return;
				assistantMessage.content += delta;
				this.state.emit({
					type: 'message.delta',
					sessionId,
					messageId: assistantMessageId,
					delta,
				});
			}
			if (
				!(await this.runUnityStatus(
					sessionId,
					assistantMessageId,
					session,
					abortController.signal,
				))
			) {
				return;
			}
			await this.runCommandListAndEdit(
				sessionId,
				assistantMessageId,
				session,
				abortController.signal,
			);
		} finally {
			assistantMessage.complete = true;
			session.summary.lastActiveAt = Date.now();
			this.state.emit({
				type: 'message.completed',
				sessionId,
				messageId: assistantMessageId,
			});
			this.state.emit({ type: 'session.state', sessionId, state: 'idle' });
			session.abortController = undefined;
			session.running = false;
		}
	}

	async steer(
		sessionId: string,
		text: string,
		attachments?: AgentAttachment[],
	) {
		await this.sessions.abort(sessionId);
		await this.prompt(sessionId, text, undefined, attachments);
	}

	private addUserMessage(
		sessionId: string,
		session: FakeSession,
		text: string,
	) {
		const messageId = this.state.nextId('message');
		const createdAt = Date.now();
		session.messages.push({
			id: messageId,
			role: 'user',
			content: text,
			createdAt,
			complete: true,
			tools: [],
		});
		session.summary.messageCount++;
		session.summary.lastActiveAt = Date.now();
		this.sessions.setTitleFromPrompt(session, text);
		this.state.emit({
			type: 'message.started',
			sessionId,
			messageId,
			role: 'user',
			createdAt: Date.now(),
		});
		this.state.emit({
			type: 'message.delta',
			sessionId,
			messageId,
			delta: text,
		});
		this.state.emit({ type: 'message.completed', sessionId, messageId });
		this.state.emit({ type: 'session.state', sessionId, state: 'streaming' });
	}

	private addAssistantMessage(sessionId: string, session: FakeSession) {
		const id = this.state.nextId('message');
		const message = {
			id,
			role: 'assistant' as const,
			content: '',
			createdAt: Date.now(),
			complete: false,
			tools: [],
		};
		session.messages.push(message);
		session.summary.messageCount++;
		this.state.emit({
			type: 'message.started',
			sessionId,
			messageId: id,
			role: 'assistant',
			createdAt: Date.now(),
		});
		return { id, message };
	}

	private async runUnityStatus(
		sessionId: string,
		messageId: string,
		session: FakeSession,
		signal: AbortSignal,
	) {
		const toolCallId = this.state.nextId('tool');
		session.messages.at(-1)!.tools.push({
			id: toolCallId,
			name: 'unity_status',
			status: 'running',
			statusText: 'Starting',
		});
		if (!(await this.state.wait(signal))) return false;
		session.messages.at(-1)!.tools[0]!.statusText =
			'Connecting to Unity Editor';
		this.state.emit({
			type: 'tool.started',
			sessionId,
			messageId,
			toolCallId,
			toolName: 'unity_status',
			input: { projectPath: '/projects/ThirdPersonSandbox' },
		});
		if (!(await this.state.wait(signal))) return false;
		Object.assign(session.messages.at(-1)!.tools[0]!, {
			status: 'complete',
			statusText: 'Completed',
			result: { state: 'connected', instances: [{ port: 6400 }] },
		});
		this.state.emit({
			type: 'tool.updated',
			sessionId,
			toolCallId,
			message: 'Connecting to Unity Editor',
		});
		if (!(await this.state.wait(signal))) return false;
		this.state.emit({
			type: 'tool.completed',
			sessionId,
			toolCallId,
			result: {
				state: 'connected',
				ok: true,
				exitCode: 0,
				instances: [
					{
						projectPath: '/projects/ThirdPersonSandbox',
						version: '6000.3.7f1',
						port: 6400,
						pid: 42,
						state: 'ready',
					},
				],
				errors: [],
				warnings: [],
			},
			isError: false,
		});
		return true;
	}

	private async runCommandListAndEdit(
		sessionId: string,
		messageId: string,
		session: FakeSession,
		signal: AbortSignal,
	) {
		const assistant = session.messages.at(-1)!;
		const listToolCallId = this.state.nextId('tool');
		assistant.tools.push({
			id: listToolCallId,
			name: 'unity_list_commands',
			status: 'running',
			statusText: 'Starting',
		});
		if (!(await this.state.wait(signal))) return;
		Object.assign(assistant.tools[1]!, {
			status: 'complete',
			statusText: 'Completed',
			result: { state: 'available' },
		});
		this.state.emit({
			type: 'tool.started',
			sessionId,
			messageId,
			toolCallId: listToolCallId,
			toolName: 'unity_list_commands',
			input: { category: 'build', includeHidden: false },
		});
		const editToolCallId = this.state.nextId('tool');
		assistant.tools.push({
			id: editToolCallId,
			name: 'edit',
			status: 'running',
			statusText: 'Starting',
		});
		this.state.emit({
			type: 'tool.started',
			sessionId,
			messageId,
			toolCallId: editToolCallId,
			toolName: 'edit',
			input: {
				file: fakeEditFile,
				oldText: 'private float moveSpeed = 4f;',
				newText: 'private float moveSpeed = 6f;',
			},
		});
		if (!(await this.state.wait(signal))) return;
		Object.assign(assistant.tools[2]!, {
			status: 'complete',
			statusText: 'Completed',
			result: fakeEditResult,
		});
		this.state.emit({
			type: 'tool.completed',
			sessionId,
			toolCallId: editToolCallId,
			result: fakeEditResult,
			isError: false,
		});
		if (!(await this.state.wait(signal))) return;
		assistant.content += ' The Editor is connected and ready for commands.';
		this.state.emit({
			type: 'tool.completed',
			sessionId,
			toolCallId: listToolCallId,
			result: {
				state: 'available',
				ok: true,
				commands: [
					{ name: 'scene.validate' },
					{ name: 'character-controller.describe' },
					{ name: 'assets.find-missing' },
				],
				errors: [],
				warnings: [],
			},
			isError: false,
		});
		if (!(await this.state.wait(signal))) return;
		this.state.emit({
			type: 'message.delta',
			sessionId,
			messageId,
			delta: ' The Editor is connected and ready for commands.',
		});
	}
}
