/**
 * Guards navigation away from an editor with unsaved changes. Callers wrap the
 * navigation in `guard()`; when the editor is dirty the action is parked until
 * the user confirms in the shared DiscardChangesDialog.
 */
export class UnsavedChangesGuard {
	dirty = $state(false);
	pending = $state<{ message: string; run: () => void }>();

	/** Runs `run` now when clean, otherwise asks first. */
	guard(message: string, run: () => void): void {
		if (!this.dirty) {
			run();
			return;
		}
		this.pending = { message, run };
	}

	confirm(): void {
		const pending = this.pending;
		this.pending = undefined;
		this.dirty = false;
		pending?.run();
	}

	cancel(): void {
		this.pending = undefined;
	}
}

export const discardSkillChanges = 'Discard the unsaved changes to this skill?';
