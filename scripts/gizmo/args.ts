export interface ParsedArgs {
	flags: Set<string>;
	/** Repeatable: `--url` twice gives two entries, which is how URLs accumulate. */
	values: Map<string, string[]>;
	positional: string[];
}

/**
 * Deliberately small: every verb here takes long flags and at most one
 * positional, so a parser dependency would be more surface than the feature.
 */
export function parseArgs(
	argv: readonly string[],
	valueFlags: ReadonlySet<string>,
): ParsedArgs {
	const flags = new Set<string>();
	const values = new Map<string, string[]>();
	const positional: string[] = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (!argument.startsWith('--')) {
			positional.push(argument);
			continue;
		}
		const equals = argument.indexOf('=');
		const name = (equals === -1 ? argument : argument.slice(0, equals)).slice(
			2,
		);
		if (!valueFlags.has(name)) {
			if (equals !== -1) throw new Error(`--${name} does not take a value.`);
			flags.add(name);
			continue;
		}
		const value =
			equals === -1 ? argv[(index += 1)] : argument.slice(equals + 1);
		if (value === undefined) throw new Error(`--${name} needs a value.`);
		values.set(name, [...(values.get(name) ?? []), value]);
	}
	return { flags, values, positional };
}

export function singleValue(
	args: ParsedArgs,
	name: string,
): string | undefined {
	return args.values.get(name)?.at(-1);
}

export function numberValue(
	args: ParsedArgs,
	name: string,
): number | undefined {
	const raw = singleValue(args, name);
	if (raw === undefined) return undefined;
	const value = Number(raw);
	if (!Number.isInteger(value))
		throw new Error(`--${name} needs a whole number.`);
	return value;
}
