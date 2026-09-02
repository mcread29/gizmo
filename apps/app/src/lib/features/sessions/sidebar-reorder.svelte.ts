import { dropEdge, reorderByDrop, type DropEdge } from '../../components';

/**
 * Workspace reordering, kept out of the sidebar component so the drag state and
 * the ordering arithmetic can be read — and tested — without a DOM.
 *
 * Dragging is the discoverable way in, but it is mouse-only, so the same
 * reordering is also reachable from the keyboard via `move`.
 */
export class WorkspaceReorder {
	draggingPath = $state<string>();
	drop = $state<{ path: string; edge: DropEdge }>();

	constructor(
		private readonly paths: () => string[],
		private readonly commit: (order: string[]) => void,
	) {}

	dragStart(event: DragEvent, path: string) {
		this.draggingPath = path;
		event.dataTransfer?.setData('text/plain', path);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	dragOver(event: DragEvent, path: string) {
		if (!this.draggingPath || this.draggingPath === path) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		this.drop = {
			path,
			edge: dropEdge(event, event.currentTarget as Element, 'y'),
		};
	}

	dragLeave(path: string) {
		if (this.drop?.path === path) this.drop = undefined;
	}

	finishDrop(event: DragEvent) {
		event.preventDefault();
		if (this.draggingPath && this.drop) {
			const paths = this.paths();
			this.apply(
				reorderByDrop(
					paths,
					paths.indexOf(this.draggingPath),
					paths.indexOf(this.drop.path),
					this.drop.edge,
				),
			);
		}
		this.draggingPath = undefined;
		this.drop = undefined;
	}

	/** Keyboard equivalent of a drag: shift one workspace by one position. */
	move(path: string, direction: -1 | 1) {
		const paths = this.paths();
		const from = paths.indexOf(path);
		const to = from + direction;
		if (from < 0 || to < 0 || to >= paths.length) return false;
		const next = [...paths];
		next[from] = paths[to]!;
		next[to] = path;
		this.apply(next);
		return true;
	}

	private apply(next: string[]) {
		const paths = this.paths();
		if (next.some((path, index) => path !== paths[index])) this.commit(next);
	}
}
