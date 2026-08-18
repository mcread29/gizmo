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
	sidebarWidth: number;
	inspectorWidth: number;
}

export type PanelName = 'sidebar' | 'inspector';

export interface PanelWidthLimit {
	min: number;
	max: number;
	default: number;
}

export const panelWidthLimits: Record<PanelName, PanelWidthLimit> = {
	sidebar: { min: 200, max: 420, default: 248 },
	inspector: { min: 240, max: 480, default: 288 },
};

export const defaultAppSettings: AppSettings = {
	theme: 'dark',
	sendOnEnter: true,
	autoFollowOutput: true,
	showThreadSidebar: true,
	showUnityInspector: true,
	sidebarWidth: panelWidthLimits.sidebar.default,
	inspectorWidth: panelWidthLimits.inspector.default,
};

/**
 * Used only when nothing has been stored yet, so a first launch matches the
 * operating system instead of forcing everyone into dark.
 */
export function systemTheme(): AppTheme {
	const prefersLight =
		typeof matchMedia === 'function' &&
		matchMedia('(prefers-color-scheme: light)').matches;
	return prefersLight ? 'light' : 'dark';
}

const settingsKey = 'unity-agent.settings.v1';

export function loadAppSettings(storage = browserStorage()): AppSettings {
	const fallback: AppSettings = { ...defaultAppSettings, theme: systemTheme() };
	if (!storage) return fallback;
	try {
		const value = JSON.parse(storage.getItem(settingsKey) ?? 'null') as unknown;
		if (!value || typeof value !== 'object') return fallback;
		const settings = value as Partial<Record<keyof AppSettings, unknown>>;
		return {
			theme: parseAppTheme(settings.theme) ?? fallback.theme,
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
			sidebarWidth: panelWidth(settings.sidebarWidth, 'sidebar'),
			inspectorWidth: panelWidth(settings.inspectorWidth, 'inspector'),
		};
	} catch {
		return fallback;
	}
}

export function clampPanelWidth(value: number, panel: PanelName): number {
	const { min, max } = panelWidthLimits[panel];
	return Math.min(max, Math.max(min, Math.round(value)));
}

function panelWidth(value: unknown, panel: PanelName): number {
	return typeof value === 'number' && Number.isFinite(value)
		? clampPanelWidth(value, panel)
		: panelWidthLimits[panel].default;
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
