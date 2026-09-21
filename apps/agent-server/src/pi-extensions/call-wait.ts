import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { createCallManager } from '../scripts/call-manager';
import {
	clampOutput,
	createDeferredDelivery,
	type CallRecord,
} from '../scripts/call-state';
import { createCallTools } from '../scripts/call-tools';

const availabilityLine =
	'Tools call, wait, call_check, call_list, call_cancel are available: call runs a workspace script with Bun and no timeout and returns a call id now; the result arrives as a follow-up message when it settles, or collect it with wait. Use call_check/call_list to peek and call_cancel to stop.';

function resultText(record: CallRecord): string {
	const head =
		record.status === 'done'
			? `Background call ${record.id} "${record.label}" finished.`
			: record.status === 'cancelled'
				? `Background call ${record.id} "${record.label}" was cancelled.`
				: `Background call ${record.id} "${record.label}" failed.`;
	const out = clampOutput(record.stdout.trim());
	const err = clampOutput(record.stderr.trim());
	const sections = [
		record.error?.trim() && `error: ${record.error.trim()}`,
		out.text && `stdout:\n${out.text}`,
		err.text && `stderr:\n${err.text}`,
	].filter(Boolean);
	return [
		`[Background call ${record.id} ${record.status}]`,
		head,
		...sections,
	].join('\n\n');
}

/**
 * Timeout-free script runs for the agent. `call` returns now; the settle
 * event is deferred and flushed as a follow-up message when the agent is
 * idle or settled — the subagents pattern — or consumed early by `wait`.
 */
export default function callWait(pi: ExtensionAPI) {
	const manager = createCallManager();
	const delivery = createDeferredDelivery<CallRecord>();
	let sessionContext: ExtensionContext | undefined;

	const updateStatus = () => {
		const ui = sessionContext?.hasUI ? sessionContext.ui : undefined;
		if (!ui) return;
		const calls = manager.list();
		const running = calls.filter((call) => call.status === 'running').length;
		ui.setStatus('calls', running > 0 ? `calls ${running} running` : undefined);
	};

	const deliver = (record: CallRecord) => {
		pi.sendMessage(
			{
				customType: 'call-result',
				content: resultText(record),
				display: true,
				details: { id: record.id, title: record.label, status: record.status },
			},
			{ deliverAs: 'followUp', triggerTurn: true },
		);
	};

	const flush = () => {
		for (const record of delivery.drain()) deliver(record);
	};

	manager.onSettled = (record, consumed) => {
		if (consumed) {
			delivery.consume([record.id]);
		} else {
			delivery.defer(record);
			if (sessionContext?.isIdle()) flush();
		}
		updateStatus();
	};

	const rawSpawn = manager.spawn.bind(manager);
	manager.spawn = (async (...args: Parameters<typeof rawSpawn>) => {
		const record = await rawSpawn(...args);
		updateStatus();
		return record;
	}) as typeof rawSpawn;

	for (const tool of createCallTools({
		manager,
		consume: (ids) => delivery.consume(ids),
	})) {
		pi.registerTool(tool);
	}

	pi.on('before_agent_start', (event) => {
		if (event.systemPrompt.includes('call_check')) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${availabilityLine}` };
	});

	pi.on('session_start', (_event, ctx) => {
		sessionContext = ctx;
		updateStatus();
	});
	pi.on('agent_settled', flush);
	pi.on('session_shutdown', async () => {
		sessionContext?.hasUI && sessionContext.ui.setStatus('calls', undefined);
		sessionContext = undefined;
		delivery.clear();
		await manager.disposeAll();
	});
}
