export const appThemes = [
	'light',
	'dark',
	'vesper-light',
	'vesper-dark',
	'catppuccin-latte',
	'catppuccin-mocha',
	'rose-pine-dawn',
	'rose-pine-moon',
	'solarized-light',
	'solarized-dark',
] as const;

export type AppTheme = (typeof appThemes)[number];
export type ThemeMode = 'light' | 'dark';

export type ColorScheme =
	'default' | 'vesper' | 'catppuccin' | 'rose-pine' | 'solarized';

export const appColorSchemes: Array<{
	value: ColorScheme;
	label: string;
}> = [
	{ value: 'default', label: 'Default' },
	{ value: 'vesper', label: 'Vesper' },
	{ value: 'catppuccin', label: 'Catppuccin' },
	{ value: 'rose-pine', label: 'Rosé Pine' },
	{ value: 'solarized', label: 'Solarized' },
];

const themeVariants: Record<ColorScheme, Record<ThemeMode, AppTheme>> = {
	default: { light: 'light', dark: 'dark' },
	vesper: { light: 'vesper-light', dark: 'vesper-dark' },
	catppuccin: { light: 'catppuccin-latte', dark: 'catppuccin-mocha' },
	'rose-pine': { light: 'rose-pine-dawn', dark: 'rose-pine-moon' },
	solarized: { light: 'solarized-light', dark: 'solarized-dark' },
};

const themeSchemes: Record<AppTheme, ColorScheme> = {
	light: 'default',
	dark: 'default',
	'vesper-light': 'vesper',
	'vesper-dark': 'vesper',
	'catppuccin-latte': 'catppuccin',
	'catppuccin-mocha': 'catppuccin',
	'rose-pine-dawn': 'rose-pine',
	'rose-pine-moon': 'rose-pine',
	'solarized-light': 'solarized',
	'solarized-dark': 'solarized',
};

export interface AppSettings {
	theme: AppTheme;
	sendOnEnter: boolean;
	autoFollowOutput: boolean;
	showThreadSidebar: boolean;
	showUnityInspector: boolean;
}

export const defaultAppSettings: AppSettings = {
	theme: 'dark',
	sendOnEnter: true,
	autoFollowOutput: true,
	showThreadSidebar: true,
	showUnityInspector: true,
};

const settingsKey = 'unity-agent.settings.v1';

export function loadAppSettings(storage = browserStorage()): AppSettings {
	if (!storage) return { ...defaultAppSettings };
	try {
		const value = JSON.parse(storage.getItem(settingsKey) ?? 'null') as unknown;
		if (!value || typeof value !== 'object') return { ...defaultAppSettings };
		const settings = value as Partial<Record<keyof AppSettings, unknown>>;
		return {
			theme: parseAppTheme(settings.theme) ?? defaultAppSettings.theme,
			sendOnEnter: boolean(
				settings.sendOnEnter,
				defaultAppSettings.sendOnEnter,
			),
			autoFollowOutput: boolean(
				settings.autoFollowOutput,
				defaultAppSettings.autoFollowOutput,
			),
			showThreadSidebar: boolean(
				settings.showThreadSidebar,
				defaultAppSettings.showThreadSidebar,
			),
			showUnityInspector: boolean(
				settings.showUnityInspector,
				defaultAppSettings.showUnityInspector,
			),
		};
	} catch {
		return { ...defaultAppSettings };
	}
}

export function isDarkTheme(theme: AppTheme): boolean {
	return getThemeMode(theme) === 'dark';
}

export function getThemeMode(theme: AppTheme): ThemeMode {
	return theme.endsWith('light') ||
		theme.endsWith('latte') ||
		theme.endsWith('dawn')
		? 'light'
		: 'dark';
}

export function getColorScheme(theme: AppTheme): ColorScheme {
	return themeSchemes[theme];
}

export function getThemeVariant(
	scheme: ColorScheme,
	mode: ThemeMode,
): AppTheme {
	return themeVariants[scheme][mode];
}

export function saveAppSettings(
	settings: AppSettings,
	storage = browserStorage(),
): void {
	try {
		storage?.setItem(settingsKey, JSON.stringify(settings));
	} catch {
		// Storage may be unavailable in a restricted webview.
	}
}

function browserStorage(): Storage | undefined {
	return typeof localStorage === 'undefined' ? undefined : localStorage;
}

function boolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function parseAppTheme(value: unknown): AppTheme | undefined {
	if (value === 'vesper') return 'vesper-dark';
	return appThemes.includes(value as AppTheme)
		? (value as AppTheme)
		: undefined;
}
