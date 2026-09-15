package slapdash

import "core:testing"

// The prototype holds smash at its initial pose, not the authored charge
// command. Its script must wait with that pose rather than creating and
// clearing ownership while the legacy contact timer is still on frame zero.
@(test)
charged_attack_script_waits_with_contact_clock :: proc(t: ^testing.T) {
	w := make_world()
	settle(&w, 60)
	p := &w.players[0]
	step_world(&w, {LogicalInput{cstick = {1, 0}}, {}})
	testing.expect(t, p.attack.move == .Fsmash && p.charging)
	testing.expect(t, attack_frame(p) == 1 && p.action_frame == 1)
	entry_events := w.events_dispatched
	for _ in 0..<30 {
		step_world(&w, {LogicalInput{cstick = {1, 0}}, {}})
		testing.expect(t, attack_frame(p) == 1 && p.action_frame == 1)
		testing.expect(t, p.live_hitboxes == 0)
		testing.expect(t, w.events_dispatched == entry_events)
	}
	for _ in 0..<15 {
		step_world(&w, {})
		testing.expect(t, !p.charging)
		testing.expect(t, p.action_frame == i32(attack_frame(p)))
		frame := i32(attack_frame(p)) - 1
		testing.expect(t, (p.live_hitboxes != 0) == (frame >= 10 && frame < 14))
	}
}
