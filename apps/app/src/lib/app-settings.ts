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
	/** Keeps `theme` in step with the operating system's light/dark choice. */
	followSystemTheme: boolean;
	sendOnEnter: boolean;
	autoFollowOutput: boolean;
	/** Whether model reasoning starts expanded rather than folded away. */
	expandReasoning: boolean;
	showThreadSidebar: boolean;
	showInspector: boolean;
	sidebarWidth: number;
	inspectorWidth: number;
	/** Inspector tab ids in the order the user arranged them. */
	inspectorTabOrder: string[];
	/** Empty means "use the built-in address for this platform". */
	agentUrl: string;
	/** Model that names new threads, `provider/id`. Empty means don't. */
	titleModel: string;
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
	// Off only once the user picks Light or Dark by hand.
	followSystemTheme: true,
	sendOnEnter: true,
	autoFollowOutput: true,
	expandReasoning: false,
	showThreadSidebar: true,
	showInspector: true,
	sidebarWidth: panelWidthLimits.sidebar.default,
	inspectorWidth: panelWidthLimits.inspector.default,
	inspectorTabOrder: [],
	agentUrl: '',
	titleModel: '',
};

/**
 * Used only when nothing has been stored yet, so a first launch matches the
 * operating system instead of forcing everyone into dark.
 */
export function systemTheme(): AppTheme {
	return systemThemeMode() === 'light' ? 'light' : 'dark';
}

export function systemThemeMode(): ThemeMode {
	return typeof matchMedia === 'function' &&
		matchMedia('(prefers-color-scheme: light)').matches
		? 'light'
		: 'dark';
}

const settingsKey = 'gizmo.settings.v1';

export function loadAppSettings(storage = browserStorage()): AppSettings {
	const fallback: AppSettings = { ...defaultAppSettings, theme: systemTheme() };
	if (!storage) return fallback;
	try {
		const value = JSON.parse(storage.getItem(settingsKey) ?? 'null') as unknown;
		if (!value || typeof value !== 'object') return fallback;
		const settings = value as Partial<
			Record<keyof AppSettings | 'showUnityInspector', unknown>
		>;
		return {
			theme: parseAppTheme(settings.theme) ?? fallback.theme,
			followSystemTheme: boolean(
				settings.followSystemTheme,
				defaultAppSettings.followSystemTheme,
			),
			sendOnEnter: boolean(
				settings.sendOnEnter,
				defaultAppSettings.sendOnEnter,
			),
			autoFollowOutput: boolean(
				settings.autoFollowOutput,
				defaultAppSettings.autoFollowOutput,
			),
			expandReasoning: boolean(
				settings.expandReasoning,
				defaultAppSettings.expandReasoning,
			),
			showThreadSidebar: boolean(
				settings.showThreadSidebar,
				defaultAppSettings.showThreadSidebar,
			),
			showInspector: boolean(
				settings.showInspector,
				boolean(settings.showUnityInspector, defaultAppSettings.showInspector),
			),
			sidebarWidth: panelWidth(settings.sidebarWidth, 'sidebar'),
			inspectorWidth: panelWidth(settings.inspectorWidth, 'inspector'),
			inspectorTabOrder: Array.isArray(settings.inspectorTabOrder)
				? settings.inspectorTabOrder.filter(
						(value): value is string => typeof value === 'string',
					)
				: [],
			agentUrl:
				typeof settings.agentUrl === 'string' ? settings.agentUrl.trim() : '',
			titleModel:
				typeof settings.titleModel === 'string'
					? settings.titleModel.trim()
					: '',
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

function integer(value: unknown, min: number, max: number, fallback: number) {
	return typeof value === 'number' && Number.isInteger(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

function parseAppTheme(value: unknown): AppTheme | undefined {
	if (value === 'vesper') return 'vesper-dark';
	return appThemes.includes(value as AppTheme)
		? (value as AppTheme)
		: undefined;
}
