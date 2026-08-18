export interface CompilerDiagnostic {
	code: string;
	message: string;
	file?: string;
	line?: number;
	column?: number;
}

export function compilerDiagnostics(value: unknown): CompilerDiagnostic[] {
	if (!Array.isArray(value)) return [];
	return value.map(compilerDiagnostic).filter((item) => item !== undefined);
}

export function compilerDiagnostic(
	value: unknown,
): CompilerDiagnostic | undefined {
	if (typeof value === 'string') return fromMessage(value);
	if (!value || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	const message =
		typeof record.message === 'string' ? record.message : undefined;
	if (!message) return;
	const parsed = fromMessage(message);
	return {
		code:
			typeof record.code === 'string' && record.code
				? record.code
				: parsed.code,
		message,
		...(typeof record.file === 'string'
			? { file: record.file }
			: parsed.file
				? { file: parsed.file }
				: {}),
		...((positiveInteger(record.line) ?? parsed.line)
			? { line: positiveInteger(record.line) ?? parsed.line }
			: {}),
		...((positiveInteger(record.column) ?? parsed.column)
			? { column: positiveInteger(record.column) ?? parsed.column }
			: {}),
	};
}

export function editorFileHref(
	diagnostic: CompilerDiagnostic,
	projectPath?: string,
): string | undefined {
	if (!diagnostic.file) return;
	const path = absolutePath(diagnostic.file, projectPath);
	const location = diagnostic.line
		? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}`
		: '';
	return `vscode://file${encodeURI(path)}${location}`;
}

function fromMessage(message: string): CompilerDiagnostic {
	const location = message.match(
		/^(.+?\.cs)(?:\((\d+),(\d+)\)|:(\d+)(?::(\d+))?)\s*:\s*/,
	);
	const code = message.match(/\b(CS\d+)\b/)?.[1] ?? 'UNITY_COMPILE_ERROR';
	return {
		code,
		message,
		...(location?.[1] ? { file: location[1] } : {}),
		...(location?.[2] || location?.[4]
			? { line: Number(location[2] ?? location[4]) }
			: {}),
		...(location?.[3] || location?.[5]
			? { column: Number(location[3] ?? location[5]) }
			: {}),
	};
}

function positiveInteger(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

function absolutePath(file: string, projectPath?: string): string {
	if (file.startsWith('/') || /^[A-Za-z]:[\\/]/.test(file)) return file;
	return projectPath ? `${projectPath.replace(/[\\/]$/, '')}/${file}` : file;
}
