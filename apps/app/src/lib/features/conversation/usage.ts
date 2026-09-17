import type { CompactionPolicy, SessionUsage } from '@gizmo/protocol';

export interface UsageView {
	/** Share of the model's window the next request will occupy, 0 to 1. */
	fraction?: number;
	/** Window share as a percentage, 0 to 100. */
	percent?: number;
	/** Where auto-compaction fires, as a share of the window, when enabled. */
	threshold?: number;
	/** How close to the wall — or to the compaction threshold — this thread is. */
	level: 'ok' | 'warn' | 'full';
	tokens: string;
	detail: string;
	/** What happens when the context grows, in the user's terms. */
	policy: string;
}

export const usageWarnAt = 0.75;
export const usageFullAt = 0.9;
/** With auto-compaction on, "warn" begins this far along the way to the threshold. */
const thresholdWarnShare = 0.8;

export function formatTokens(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
	return String(count);
}

function formatCost(cost: number): string {
	return cost >= 0.01 ? `$${cost.toFixed(2)}` : `$${cost.toFixed(4)}`;
}

/**
 * A meter placeholder for threads that have not completed a response yet:
 * a new session, a thread being resumed, or one just after compaction.
 */
export function emptyUsage(contextWindow?: number): SessionUsage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		contextUsed: 0,
		cost: 0,
		...(contextWindow ? { contextWindow } : {}),
	};
}

/**
 * Context is reported as what the *next* request has to carry, because that is
 * the number that decides whether the next turn fits. A `contextUsed` of zero
 * means no response has reported usage yet, so the window share is unknown.
 *
 * The meter is read against the user's own auto-compaction threshold rather
 * than the model's wall: with compaction at 25%, a ring that only turns amber
 * at 75% describes a limit the thread will never reach.
 */
export function usageView(
	usage: SessionUsage,
	compaction?: CompactionPolicy,
): UsageView {
	const hasUsage = usage.contextUsed > 0;
	const fraction =
		hasUsage && usage.contextWindow
			? usage.contextUsed / usage.contextWindow
			: undefined;
	const percent =
		fraction !== undefined ? Math.round(fraction * 1000) / 10 : undefined;
	const threshold = compaction?.enabled
		? compaction.fillPercent / 100
		: undefined;
	const warnAt = threshold ? threshold * thresholdWarnShare : usageWarnAt;
	const fullAt = threshold ?? usageFullAt;
	const level =
		fraction === undefined || fraction < warnAt
			? 'ok'
			: fraction < fullAt
				? 'warn'
				: 'full';
	const tokens = !hasUsage
		? usage.contextWindow
			? `– / ${formatTokens(usage.contextWindow)}`
			: '–'
		: usage.contextWindow
			? `${formatTokens(usage.contextUsed)} / ${formatTokens(usage.contextWindow)}`
			: formatTokens(usage.contextUsed);
	const detail = hasUsage
		? [
				`${formatTokens(usage.input)} in`,
				`${formatTokens(usage.output)} out`,
				usage.cacheRead ? `${formatTokens(usage.cacheRead)} cached` : '',
				formatCost(usage.cost),
			]
				.filter(Boolean)
				.join(' · ')
		: 'Waiting for the first response to report usage';
	const policy = !compaction
		? ''
		: !compaction.enabled
			? 'Auto-compaction is off'
			: usage.contextWindow
				? `Auto-compacts at ${compaction.fillPercent}% (${formatTokens(
						Math.round((usage.contextWindow * compaction.fillPercent) / 100),
					)})`
				: `Auto-compacts at ${compaction.fillPercent}%`;
	return {
		...(fraction === undefined ? {} : { fraction }),
		...(percent === undefined ? {} : { percent }),
		...(threshold === undefined ? {} : { threshold }),
		level,
		tokens,
		detail,
		policy,
	};
}
