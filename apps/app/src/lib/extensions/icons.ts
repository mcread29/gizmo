import {
	Activity,
	Bell,
	Bot,
	Bug,
	Check,
	CircleAlert,
	CircleCheck,
	CircleX,
	Clock,
	Code,
	CornerUpLeft,
	Database,
	Ellipsis,
	File,
	FileDiff,
	FilePlus2,
	FileCode2,
	FileText,
	Folder,
	FolderOpen,
	GitBranch,
	GitCommitHorizontal,
	Minus,
	Plus,
	Globe,
	Hammer,
	Info,
	Layers,
	List,
	Package,
	Play,
	Plug,
	PlugZap,
	Puzzle,
	RefreshCw,
	Search,
	Server,
	Settings,
	Sparkles,
	Terminal,
	TriangleAlert,
	Upload,
	Wrench,
	Zap,
} from '@lucide/svelte';
import type { Component } from 'svelte';

/*
 * Extensions name an icon, they do not ship one. The set is deliberately
 * small and explicit rather than a dynamic import of all 1,500 lucide icons:
 * adding one is a line here, and an unknown name falls back to the puzzle
 * piece instead of breaking the bar it was asked for.
 */
const icons: Record<string, Component<any>> = {
	activity: Activity,
	bell: Bell,
	bot: Bot,
	bug: Bug,
	check: Check,
	'circle-alert': CircleAlert,
	'circle-check': CircleCheck,
	'circle-x': CircleX,
	clock: Clock,
	code: Code,
	'corner-up-left': CornerUpLeft,
	database: Database,
	ellipsis: Ellipsis,
	file: File,
	'file-diff': FileDiff,
	'file-plus': FilePlus2,
	'file-code': FileCode2,
	'file-text': FileText,
	folder: Folder,
	'folder-open': FolderOpen,
	'git-branch': GitBranch,
	'git-commit': GitCommitHorizontal,
	minus: Minus,
	globe: Globe,
	hammer: Hammer,
	info: Info,
	layers: Layers,
	list: List,
	package: Package,
	play: Play,
	plus: Plus,
	plug: Plug,
	'plug-zap': PlugZap,
	puzzle: Puzzle,
	'refresh-cw': RefreshCw,
	search: Search,
	server: Server,
	settings: Settings,
	sparkles: Sparkles,
	terminal: Terminal,
	'triangle-alert': TriangleAlert,
	upload: Upload,
	wrench: Wrench,
	zap: Zap,
};

/** The component for a lucide icon name, or the fallback when it is unknown. */
export function extensionIcon(name: string | undefined): Component<any> {
	return (name && icons[name]) || Puzzle;
}

export function hasExtensionIcon(name: string | undefined): boolean {
	return Boolean(name && name in icons);
}
