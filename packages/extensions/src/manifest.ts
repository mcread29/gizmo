/** Version of the extension contract, independent of the transport protocol. */
export const extensionApiVersion = 1;

export interface ExtensionManifest {
	apiVersion: number;
	web: boolean;
	capabilities: string[];
}

export function parseExtensionManifest(
	input: unknown,
	requireSupported = true,
): ExtensionManifest {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new Error('Extension manifest must be an object');
	}
	const value = input as Partial<ExtensionManifest>;
	if (
		typeof value.apiVersion !== 'number' ||
		!Number.isInteger(value.apiVersion) ||
		value.apiVersion < 1
	) {
		throw new Error('Extension manifest needs a positive integer apiVersion');
	}
	if (requireSupported && value.apiVersion !== extensionApiVersion) {
		throw new Error(
			`Unsupported extension apiVersion ${value.apiVersion}; host supports ${extensionApiVersion}`,
		);
	}
	if (typeof value.web !== 'boolean') {
		throw new Error('Extension manifest needs a boolean web field');
	}
	if (
		!Array.isArray(value.capabilities) ||
		!value.capabilities.every(
			(capability) =>
				typeof capability === 'string' && /^[a-z][a-z0-9.-]*$/.test(capability),
		)
	) {
		throw new Error(
			'Extension manifest needs a capabilities array of identifiers',
		);
	}
	return {
		apiVersion: value.apiVersion,
		web: value.web,
		capabilities: [...new Set(value.capabilities)],
	};
}
