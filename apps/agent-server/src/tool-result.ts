const noOutput = 'No output';

export function normalizeToolResult(result: unknown): unknown {
	if (isRecord(result)) {
		const details = result.details;
		if (details !== undefined && details !== null) {
			return jsonSafe(details) ?? noOutput;
		}

		const text = messageText(result.content);
		if (text) return text;

		if ('content' in result || 'details' in result) return noOutput;
	}

	return jsonSafe(result) ?? noOutput;
}

export function toolResultIsError(result: unknown): boolean {
	if (!isRecord(result)) return false;
	const details = isRecord(result.details) ? result.details : result;
	return details.ok === false;
}

function messageText(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter(
			(item): item is { type: 'text'; text: string } =>
				isRecord(item) && item.type === 'text' && typeof item.text === 'string',
		)
		.map((item) => item.text)
		.join('');
}

function jsonSafe(value: unknown): unknown | undefined {
	try {
		const serialized = JSON.stringify(value);
		return serialized === undefined ? undefined : JSON.parse(serialized);
	} catch {
		const fallback = String(value);
		return fallback === 'undefined' ? undefined : fallback;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}
