import { beforeEach, describe, expect, it } from 'vitest';
import {
	appColorSchemes,
	defaultAppSettings,
	getColorScheme,
	getThemeMode,
	getThemeVariant,
	isDarkTheme,
	loadAppSettings,
	saveAppSettings,
} from '../../src/lib/app-settings';

describe('app settings', () => {
	beforeEach(() => localStorage.clear());

	it('persists functional app preferences', () => {
		const settings = {
			...defaultAppSettings,
			theme: 'vesper-dark' as const,
			sendOnEnter: false,
			showInspector: false,
		};

		saveAppSettings(settings);

		expect(loadAppSettings()).toEqual(settings);
	});

	it('migrates the former Unity compile policy into extension settings', () => {
		localStorage.setItem(
			'gizmo.settings.v1',
			JSON.stringify({ compilePlayModePolicy: 'keep_playing' }),
		);

		expect(
			loadAppSettings().extensionSettings.unity?.compilePlayModePolicy,
		).toBe('keep_playing');
	});

	it('migrates the former Unity-specific inspector preference', () => {
		localStorage.setItem(
			'gizmo.settings.v1',
			JSON.stringify({ showUnityInspector: false }),
		);

		expect(loadAppSettings().showInspector).toBe(false);
	});

	it('pairs every color scheme with light and dark variants', () => {
		expect(appColorSchemes.map((option) => option.label)).toEqual([
			'Default',
			'Vesper',
			'Catppuccin',
			'Rosé Pine',
			'Solarized',
		]);
		expect(getThemeVariant('vesper', 'light')).toBe('vesper-light');
		expect(getThemeVariant('vesper', 'dark')).toBe('vesper-dark');
		expect(getThemeVariant('catppuccin', 'light')).toBe('catppuccin-latte');
		expect(getThemeVariant('rose-pine', 'dark')).toBe('rose-pine-moon');
		expect(getThemeVariant('solarized', 'dark')).toBe('solarized-dark');
		expect(getColorScheme('rose-pine-dawn')).toBe('rose-pine');
		expect(getThemeMode('catppuccin-latte')).toBe('light');
		expect(isDarkTheme('vesper-dark')).toBe(true);
		expect(isDarkTheme('catppuccin-mocha')).toBe(true);
		expect(isDarkTheme('rose-pine-dawn')).toBe(false);
		expect(isDarkTheme('solarized-light')).toBe(false);
	});

	it('migrates the previous Vesper theme value to its dark variant', () => {
		localStorage.setItem(
			'gizmo.settings.v1',
			JSON.stringify({ ...defaultAppSettings, theme: 'vesper' }),
		);

		expect(loadAppSettings().theme).toBe('vesper-dark');
	});

	it('falls back safely when stored settings are invalid', () => {
		localStorage.setItem('gizmo.settings.v1', '{broken');

		expect(loadAppSettings()).toEqual(defaultAppSettings);
	});

	it('clamps persisted compaction settings', () => {
		localStorage.setItem(
			'gizmo.settings.v1',
			JSON.stringify({
				...defaultAppSettings,
				autoCompactFillPercent: 100,
				compactionRetainPercent: 100,
			}),
		);

		expect(loadAppSettings()).toMatchObject({
			autoCompactFillPercent: 95,
			compactionRetainPercent: 90,
		});
	});
});
