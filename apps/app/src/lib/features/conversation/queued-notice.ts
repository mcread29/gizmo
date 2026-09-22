/**
 * What is already waiting on the run, so a second send is not a surprise.
 * Undefined when nothing is queued.
 */
export function queuedNotice(
	queue: { steering: string[]; followUp: string[] } | undefined,
): string | undefined {
	const steering = queue?.steering.length ?? 0;
	const followUp = queue?.followUp.length ?? 0;
	const parts = [
		steering ? `${steering} steering` : '',
		followUp ? `${followUp} follow-up` : '',
	].filter(Boolean);
	if (!parts.length) return undefined;
	return `Queued: ${parts.join(' · ')} · delivered as the run allows`;
}
