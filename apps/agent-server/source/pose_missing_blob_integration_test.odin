package slapdash

import "core:os"
import "core:testing"

// Run only through test-pose-missing-blob.ps1: cwd and the pose cache are
// process-global. The ordinary suite must never register this fixture.
when #config(POSE_MISSING_BLOB_INTEGRATION, false) {
	@(test)
	pose_missing_blob_fallback_and_recovery :: proc(t: ^testing.T) {
		if !testing.expect(t, !pose_blob_loaded && len(pose_blob) == 0) do return
		// Both real loader paths are absent in the script's private directory.
		if !testing.expect(t, !ensure_pose_blob()) do return
		testing.expect(t, !pose_blob_loaded && len(pose_blob) == 0)
		w := make_world()
		a, d := &w.players[0], &w.players[1]
		a.pos, a.facing, a.grounded = {0, STAGE_Y}, 1, true
		d.pos, d.facing, d.grounded = {6, STAGE_Y}, -1, true
		wind_to_frame(a, .Jab, 5)
		a.attack.timer -= FIXED_DT
		// These states resolve normally: failure is file I/O, not an unknown action.
		testing.expect(t, pose_action_for_state(&w, a, {}) >= 0)
		testing.expect(t, pose_action_for_state(&w, d, {}) >= 0)
		for p in &w.players {
			update_pose(&w, p, {})
			testing.expect(t, p.pose_action == -1 && p.pose_frame == 0)
			testing.expect(t, p.ecb == MARTH_ECB && p.ecb_live == MARTH_ECB)
		}
		box, live := hitbox_aabb(a, 0)
		if !testing.expect(t, live) do return
		_, _, sphere_live := hitbox_sphere(a, 0)
		testing.expect(t, !sphere_live)
		_, _, hurt_live := hurtbox_world(d, melee_hurtboxes[0])
		testing.expect(t, !hurt_live)
		testing.expect(t, aabb_overlap(box, body_aabb(d)))
		testing.expect(t, combat_row_contact(a, d, 0) == .hit)
		testing.expect(t, collect_combat_contacts(w.players)[0].kind == .hit)
		d.pos.x = 100
		testing.expect(t, combat_row_contact(a, d, 0) == .none)
		d.pos.x = 6

		// No cache reset: a failed load must remain retryable in this process.
		if !testing.expect(t, os.set_current_directory("../recovery") == nil) do return
		if !testing.expect(t, ensure_pose_blob()) do return
		testing.expect(t, pose_blob_loaded && len(pose_blob) == 8684892)
		for p in &w.players {
			update_pose(&w, p, {})
			testing.expect(t, p.pose_action >= 0 && p.ecb_live != MARTH_ECB)
		}
		testing.expect(t, abs(d.ecb_live.top.y - 14.6) < 0.3)
		_, radius, recovered_sphere := hitbox_sphere(a, 0)
		testing.expect(t, recovered_sphere && radius > 0)
		_, _, recovered_hurt := hurtbox_world(d, melee_hurtboxes[0])
		testing.expect(t, recovered_hurt)
		// Prove recovered posed geometry participates in actual contact.
		found := false
		for x in 0..<20 {
			d.pos.x = f32(x)
			if combat_row_contact(a, d, 0) == .hit {
				found = true
				testing.expect(t, collect_combat_contacts(w.players)[0].kind == .hit)
				break
			}
		}
		testing.expect(t, found)
		d.pos.x = 100
		testing.expect(t, combat_row_contact(a, d, 0) == .none)
	}
}
