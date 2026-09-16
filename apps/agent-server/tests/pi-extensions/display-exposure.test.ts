import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { displayExtensionPath } from '../../src/sessions/pi-session-factory';
import { displayGuidance } from '../../src/pi-extensions/display';

const workspaces: string[] = [];
afterEach(async () => {
	await Promise.all(
		workspaces
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

async function buildSession(override?: string) {
	const {
		createAgentSessionFromServices,
		createAgentSessionServices,
		SessionManager,
	} = await import('@earendil-works/pi-coding-agent');
	const cwd = await mkdtemp(join(tmpdir(), 'gizmo-display-'));
	workspaces.push(cwd);
	const services = await createAgentSessionServices({
		cwd,
		agentDir: join(cwd, 'agent'),
		resourceLoaderOptions: {
			noExtensions: true,
			additionalExtensionPaths: [displayExtensionPath()],
			noSkills: true,
			noPromptTemplates: true,
			noContextFiles: true,
			...(override ? { systemPromptOverride: () => override } : {}),
		},
	});
	const { session } = await createAgentSessionFromServices({
		services,
		sessionManager: SessionManager.inMemory(cwd),
	});
	await session.bindExtensions({ mode: 'json' });
	return { session, cwd };
}

describe('built-in display registration', () => {
	it('loads the actual extension and advertises the catalog and input', async () => {
		const { session, cwd } = await buildSession();
		try {
			const tool = session
				.getAllTools()
				.find((tool) => tool.name === 'display');
			expect(tool?.description).toContain('Metric');
			expect(tool?.description).toContain('"input"');
			expect(session.systemPrompt).toContain('- display:');
			expect(session.systemPrompt).toContain(displayGuidance);
			const result = await session.extensionRunner.emitBeforeAgentStart(
				'hi',
				undefined,
				session.systemPrompt,
				{ cwd },
			);
			expect(result?.systemPrompt).toBeUndefined();
		} finally {
			session.dispose();
		}
	});

	it('restores guidance when a custom system prompt replaces the tool list', async () => {
		const { session, cwd } = await buildSession('Custom assistant.');
		try {
			const result = await session.extensionRunner.emitBeforeAgentStart(
				'hi',
				undefined,
				session.systemPrompt,
				{ cwd },
			);
			expect(result?.systemPrompt).toContain('Custom assistant.');
			expect(result?.systemPrompt).toContain(displayGuidance);
		} finally {
			session.dispose();
		}
	});

	it('is wired alongside the journal in the session factory', async () => {
		const source = await readFile(
			new URL('../../src/sessions/pi-session-factory.ts', import.meta.url),
			'utf8',
		);
		expect(source).toMatch(
			/additionalExtensionPaths:\s*\[\s*journalExtensionPath\(\),\s*displayExtensionPath\(\),/,
		);
	});
});
