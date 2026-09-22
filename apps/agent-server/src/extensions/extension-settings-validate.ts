import { readModelSetting, type SettingsField } from '@gizmo/extension-api';

/**
 * Checks a settings patch against the fields the extension declared. Unknown
 * keys are rejected outright; `null` and `undefined` clear a key and come
 * back as `undefined`.
 */
export function validateSettingsValues(
	extensionId: string,
	values: Record<string, unknown>,
	fields: readonly SettingsField[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(values)) {
		const field = fields.find((entry) => entry.key === key);
		if (!field)
			throw new Error(`Extension ${extensionId} has no setting: ${key}`);
		result[key] =
			value === null || value === undefined
				? undefined
				: checkValue(field, value);
	}
	return result;
}

function checkValue(field: SettingsField, value: unknown): unknown {
	switch (field.kind) {
		case 'text':
			if (typeof value !== 'string') throw invalid(field.key, 'a string');
			return value;
		case 'number': {
			if (typeof value !== 'number' || !Number.isFinite(value))
				throw invalid(field.key, 'a number');
			if (field.min !== undefined && value < field.min)
				throw invalid(field.key, `at least ${field.min}`);
			if (field.max !== undefined && value > field.max)
				throw invalid(field.key, `at most ${field.max}`);
			return value;
		}
		case 'boolean':
			if (typeof value !== 'boolean') throw invalid(field.key, 'true or false');
			return value;
		case 'select': {
			const options = field.options.map((option) => option.value);
			if (typeof value !== 'string' || !options.includes(value))
				throw invalid(field.key, `one of ${options.join(', ')}`);
			return value;
		}
		case 'model': {
			const model = readModelSetting(value);
			if (!model) throw invalid(field.key, 'a model with a provider and id');
			if (model.thinkingLevel && !field.thinking)
				throw invalid(field.key, 'a model without a thinking level');
			return model;
		}
	}
}

function invalid(key: string, expected: string): Error {
	return new Error(`Setting ${key} must be ${expected}`);
}
