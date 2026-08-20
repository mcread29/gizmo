import {
	clampPanelWidth,
	defaultAppSettings,
	getColorScheme,
	isDarkTheme,
	getThemeVariant,
	loadAppSettings,
	panelWidthLimits,
	systemThemeMode,
	type AppSettings,
	type AppTheme,
	type CompilePlayModePolicy,
	type PanelName,
} from '../../app-settings';
import {
	currentViewportWidth,
	inspectorMode,
	sidebarMode,
	type PanelMode,
} from '../../layout';

/** Space the conversation column must keep for itself, in pixels. */
const conversationFloor = 420;

/**
 * Everything about the shape of the workspace: which panels exist, how wide
 * they are, and which of them the current window is too narrow to dock. Kept
 * out of the component so the rules are readable in one place and testable
 * without rendering.
 */
export class WorkspaceLayout {
	theme = $state<AppTheme>('dark');
	followSystemTheme = $state(false);
	sendOnEnter = $state(true);
	autoFollowOutput = $state(true);
	expandReasoning = $state(false);
	autoCompact = $state(true);
	autoCompactFillPercent = $state(25);
	compactionRetainPercent = $state(10);
	compilePlayModePolicy = $state<CompilePlayModePolicy>('ask');
	showThreadSidebar = $state(true);
	showUnityInspector = $state(true);
	sidebarWidth = $state(panelWidthLimits.sidebar.default);
	inspectorWidth = $state(panelWidthLimits.inspector.default);
	agentUrl = $state('');

	viewportWidth = $state(currentViewportWidth());
	leftDrawerOpen = $state(false);
	rightDrawerOpen = $state(false);

	readonly leftMode: PanelMode = $derived(sidebarMode(this.viewportWidth));
	readonly rightMode: PanelMode = $derived(inspectorMode(this.viewportWidth));
	readonly darkTheme = $derived(isDarkTheme(this.theme));
	readonly leftVisible = $derived(
		this.leftMode === 'overlay' ? this.leftDrawerOpen : this.showThreadSidebar,
	);
	readonly rightVisible = $derived(
		this.rightMode === 'overlay'
			? this.rightDrawerOpen
			: this.showUnityInspector,
	);
	readonly drawerOpen = $derived(
		(this.leftMode === 'overlay' && this.leftDrawerOpen) ||
			(this.rightMode === 'overlay' && this.rightDrawerOpen),
	);
	readonly sidebarMax = $derived(
		this.#panelMax('sidebar', this.rightVisible ? this.inspectorWidth : 0),
	);
	readonly inspectorMax = $derived(
		this.#panelMax('inspector', this.leftVisible ? this.sidebarWidth : 0),
	);

	constructor(settings: AppSettings = loadAppSettings()) {
		this.#applySettings(settings);
	}

	restoreDefaults(): void {
		this.#applySettings({ ...defaultAppSettings, agentUrl: this.agentUrl });
	}

	#applySettings(settings: AppSettings): void {
		this.theme = settings.theme;
		this.followSystemTheme = settings.followSystemTheme;
		if (settings.followSystemTheme) this.applySystemThemeMode();
		this.sendOnEnter = settings.sendOnEnter;
		this.autoFollowOutput = settings.autoFollowOutput;
		this.expandReasoning = settings.expandReasoning;
		this.autoCompact = settings.autoCompact;
		this.autoCompactFillPercent = settings.autoCompactFillPercent;
		this.compactionRetainPercent = settings.compactionRetainPercent;
		this.compilePlayModePolicy = settings.compilePlayModePolicy;
		this.showThreadSidebar = settings.showThreadSidebar;
		this.showUnityInspector = settings.showUnityInspector;
		this.sidebarWidth = settings.sidebarWidth;
		this.inspectorWidth = settings.inspectorWidth;
		this.agentUrl = settings.agentUrl;
	}

	get settings(): AppSettings {
		return {
			theme: this.theme,
			followSystemTheme: this.followSystemTheme,
			sendOnEnter: this.sendOnEnter,
			autoFollowOutput: this.autoFollowOutput,
			expandReasoning: this.expandReasoning,
			autoCompact: this.autoCompact,
			autoCompactFillPercent: this.autoCompactFillPercent,
			compactionRetainPercent: this.compactionRetainPercent,
			compilePlayModePolicy: this.compilePlayModePolicy,
			showThreadSidebar: this.showThreadSidebar,
			showUnityInspector: this.showUnityInspector,
			sidebarWidth: this.sidebarWidth,
			inspectorWidth: this.inspectorWidth,
			agentUrl: this.agentUrl,
		};
	}

	/** Re-reads the window and shrinks docked panels that no longer fit. */
	measure(width = currentViewportWidth()): void {
		this.viewportWidth = width;
		if (inspectorMode(width) === 'overlay') return;
		const available = width - conversationFloor;
		if (this.sidebarWidth + this.inspectorWidth <= available) return;
		this.inspectorWidth = clampPanelWidth(
			available - this.sidebarWidth,
			'inspector',
		);
		if (this.sidebarWidth + this.inspectorWidth > available) {
			this.sidebarWidth = clampPanelWidth(
				available - this.inspectorWidth,
				'sidebar',
			);
		}
	}

	toggleLeft(): void {
		if (this.leftMode === 'overlay') {
			this.leftDrawerOpen = !this.leftDrawerOpen;
			if (this.leftDrawerOpen) this.rightDrawerOpen = false;
		} else {
			this.showThreadSidebar = !this.showThreadSidebar;
		}
	}

	toggleRight(): void {
		if (this.rightMode === 'overlay') {
			this.rightDrawerOpen = !this.rightDrawerOpen;
			if (this.rightDrawerOpen) this.leftDrawerOpen = false;
		} else {
			this.showUnityInspector = !this.showUnityInspector;
		}
	}

	closeDrawers(): void {
		this.leftDrawerOpen = false;
		this.rightDrawerOpen = false;
	}

	toggleTheme(): void {
		// An explicit flip is a decision, so it stops tracking the system.
		this.followSystemTheme = false;
		this.theme = this.darkTheme ? 'light' : 'dark';
	}

	/** Re-reads the OS preference. Called on load and when the OS changes. */
	applySystemThemeMode(): void {
		if (!this.followSystemTheme) return;
		this.theme = getThemeVariant(getColorScheme(this.theme), systemThemeMode());
	}

	resize(panel: PanelName, size: number): void {
		const width = clampPanelWidth(size, panel);
		if (panel === 'sidebar') this.sidebarWidth = width;
		else this.inspectorWidth = width;
	}

	reset(panel: PanelName): void {
		this.resize(panel, panelWidthLimits[panel].default);
	}

	#panelMax(panel: PanelName, otherWidth: number): number {
		const { min, max } = panelWidthLimits[panel];
		return Math.max(
			min,
			Math.min(max, this.viewportWidth - otherWidth - conversationFloor),
		);
	}
}
