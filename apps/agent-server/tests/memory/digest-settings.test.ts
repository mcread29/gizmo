import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigestSettingsStore } from '../../src/memory/digest-settings';

const alpha = 'C:/work/alpha';
const beta = 'C:/work/beta';
const haiku = { provider: 'anthropic', id: 'haiku' };
const mini = { provider: 'openai', id: 'mini' };

describe('DigestSettingsStore', () => {
	let dataDir: string;
	let store: DigestSettingsStore;

	beforeEach(async () => {
		dataDir = await mkdtemp(join(tmpdir(), 'gizmo-digest-settings-'));
		store = new DigestSettingsStore(dataDir);
	});

	afterEach(async () => {
		await rm(dataDir, { recursive: true, force: true });
	});

	it('gives every workspace the default until one overrides it', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		expect(await store.read(alpha)).toEqual({ auto: true, model: haiku });
		expect(await store.read(beta)).toEqual({ auto: true, model: haiku });
		expect(await store.readOverride(alpha)).toBeUndefined();
	});

	it('overrides one workspace without touching the others', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { model: mini });

		expect(await store.read(alpha)).toEqual({ auto: true, model: mini });
		expect(await store.read(beta)).toEqual({ auto: true, model: haiku });
		expect(await store.readOverride(alpha)).toEqual({ model: mini });
		expect(await store.readOverride(beta)).toBeUndefined();
	});

	/**
	 * The distinction the nullable model exists for. "Off here" has to survive
	 * as a decision rather than collapsing into "nothing chosen", which would
	 * silently inherit the default and digest anyway.
	 */
	it('tells "off in this workspace" apart from "inherit"', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { model: null });
		expect(await store.read(alpha)).toEqual({ auto: true });

		await store.writeOverride(alpha, undefined);
		expect(await store.read(alpha)).toEqual({ auto: true, model: haiku });
	});

	it('inherits the keys an override leaves out', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { auto: false });
		expect(await store.read(alpha)).toEqual({ auto: false, model: haiku });
	});

	it('keeps overrides when the default changes', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { model: mini });
		await store.writeDefault({ auto: false, model: haiku });

		expect(await store.read(alpha)).toEqual({ auto: false, model: mini });
		expect(await store.readOverride(alpha)).toEqual({ model: mini });
	});

	it('survives a round trip through the file', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { model: null });
		await store.writeOverride(beta, { model: mini, auto: false });

		const reopened = new DigestSettingsStore(dataDir);
		expect(await reopened.read(alpha)).toEqual({ auto: true });
		expect(await reopened.read(beta)).toEqual({ auto: false, model: mini });
		expect(await reopened.readDefault()).toEqual({ auto: true, model: haiku });
	});

	it('reads defaults when the file is missing or corrupt', async () => {
		expect(await store.read(alpha)).toEqual({ auto: true });
		const { writeFile } = await import('node:fs/promises');
		await writeFile(join(dataDir, 'memory-digest.json'), 'not json', 'utf8');
		expect(await store.read(alpha)).toEqual({ auto: true });
	});

	it('leaves no projects key behind once every override is cleared', async () => {
		await store.writeDefault({ auto: true, model: haiku });
		await store.writeOverride(alpha, { model: mini });
		await store.writeOverride(alpha, undefined);

		const raw = await readFile(join(dataDir, 'memory-digest.json'), 'utf8');
		expect(JSON.parse(raw)).toEqual({ auto: true, model: haiku });
	});
});
