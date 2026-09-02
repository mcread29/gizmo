import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { journalExtensionPath } from '../../src/sessions/pi-session-factory';

/**
 * Builds a session the way the factory does — through Pi's own loader with
 * the journal extension on `additionalExtensionPaths` — and asks what the
 * model would actually be told. Registering a tool proves nothing on its own:
 * the default prompt lists it, but Gizmo's `systemPromptOverride` replaces
 * that prompt wholesale and drops the list, so both cases are checked here.
 */
async function buildSession(workspace: string, override?: string) {
	const {
		createAgentSessionFromServices,
		createAgentSessionServices,
		SessionManager,
	} = await import('@earendil-works/pi-coding-agent');
	const services = await createAgentSessionServices({
		cwd: workspace,
		agentDir: join(workspace, 'agent'),
		resourceLoaderOptions: {
			noExtensions: true,
			additionalExtensionPaths: [journalExtensionPath()],
			noSkills: true,
			noPromptTemplates: true,
			noContextFiles: true,
			...(override ? { systemPromptOverride: () => override } : {}),
		},
	});
	const { session } = await createAgentSessionFromServices({
		services,
		sessionManager: SessionManager.inMemory(workspace),
	});
	await session.bindExtensions({ mode: 'json' });
	return session;
}

describe('journal tool exposure', () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), 'gizmo-journal-exposure-'));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it('is loaded through the real extension path and registers both tools', async () => {
		const session = await buildSession(workspace);
		const names = session.getAllTools().map((tool) => tool.name);

		expect(names).toContain('journal_search');
		expect(names).toContain('journal_read');
	});

	it('appears in the default system prompt with its guidelines', async () => {
		const session = await buildSession(workspace);

		expect(session.systemPrompt).toContain('- journal_search:');
		expect(session.systemPrompt).toContain('Use journal_search when');
	});

	it('is named in the prompt sent for a turn when the system prompt is overridden', async () => {
		const session = await buildSession(
			workspace,
			'You are a custom assistant.',
		);
		// The override really does drop the tool list...
		expect(session.systemPrompt).not.toContain('journal_search');

		// ...and the turn-time hook is what puts the tools back.
		const result = await session.extensionRunner.emitBeforeAgentStart(
			'hello',
			undefined,
			session.systemPrompt,
			{ cwd: workspace },
		);

		expect(result?.systemPrompt).toContain('You are a custom assistant.');
		expect(result?.systemPrompt).toContain('journal_search');
		expect(result?.systemPrompt).toContain('journal_read');
	});

	it('does not repeat the tools when the default prompt already lists them', async () => {
		const session = await buildSession(workspace);

		const result = await session.extensionRunner.emitBeforeAgentStart(
			'hello',
			undefined,
			session.systemPrompt,
			{ cwd: workspace },
		);

		expect(result?.systemPrompt).toBeUndefined();
	});
});
