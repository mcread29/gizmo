export function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function attachmentPrompt(count: number) {
	return `Please inspect the attached ${count === 1 ? 'file' : 'files'}.`;
}
