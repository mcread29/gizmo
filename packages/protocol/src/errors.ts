export class ProtocolValidationError extends Error {
	constructor(kind: 'request' | 'response' | 'event', input: unknown) {
		super(`Invalid agent protocol ${kind}`);
		this.name = 'ProtocolValidationError';
		this.cause = input;
	}
}
