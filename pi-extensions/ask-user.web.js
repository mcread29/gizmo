//#region \0gizmo-host:svelte/internal/client
var e = globalThis.__gizmoHostModules__["svelte/internal/client"];
if (!e) throw Error("Gizmo host module \"svelte/internal/client\" is unavailable; the host must publish it before loading extensions.");
e.CLASS, e.FILENAME, e.HMR, e.NAMESPACE_SVG, e.STYLE, e.aborted, e.action, e.active_effect, e.add_legacy_event_listener, e.add_locations, e.add_svelte_meta, e.animation;
var t = e.append;
e.append_styles, e.apply, e.assign, e.assign_async, e.async, e.async_derived, e.attach, e.attachment, e.attr, e.attribute_effect, e.autofocus, e.await, e.bind_active_element, e.bind_buffered, e.bind_checked, e.bind_content_editable, e.bind_current_time, e.bind_element_size, e.bind_ended, e.bind_files, e.bind_focused, e.bind_group, e.bind_muted, e.bind_online, e.bind_paused, e.bind_playback_rate, e.bind_played, e.bind_prop, e.bind_property, e.bind_ready_state, e.bind_resize_observer, e.bind_seekable, e.bind_seeking, e.bind_select_value, e.bind_this, e.bind_value, e.bind_volume, e.bind_window_scroll, e.bind_window_size, e.boundary, e.bubble_event, e.check_target;
var n = e.child;
e.cleanup_styles, e.clsx, e.comment, e.component, e.create_custom_element, e.create_ownership_validator, e.css_props, e.customizable_select, e.deep_read, e.deep_read_state, e.deferred_template_effect, e.delegate, e.delegated;
var r = e.derived;
e.derived_safe_equal, e.document;
var i = e.each;
e.eager, e.effect, e.effect_root, e.effect_tracking, e.element, e.equals, e.event, e.exclude_from_object, e.fallback, e.first_child, e.flush, e.for_await_track_reactivity_loss;
var a = e.from_html;
e.from_mathml, e.from_svg, e.from_tree;
var o = e.get;
e.head, e.hmr, e.html, e.hydrate_template;
var s = e.if;
e.index, e.init, e.init_select, e.inspect, e.invalid_default_snippet, e.invalidate_inner_signals, e.invalidate_store, e.key, e.legacy_api, e.legacy_pre_effect, e.legacy_pre_effect_reset, e.legacy_rest_props, e.log_if_contains_state, e.mark_store_binding, e.mutable_source, e.mutate, e.next, e.noop, e.once, e.pending;
var c = e.pop;
e.preventDefault, e.prevent_snippet_stringification, e.prop, e.props_id, e.proxy;
var l = e.push;
e.raf, e.reactive_import, e.remove_input_defaults, e.remove_textarea_child, e.render_effect, e.replay_events;
var u = e.reset;
e.rest_props, e.run, e.run_after_blockers, e.safe_get, e.sanitize_slots, e.save, e.select_option, e.selectedcontent, e.self, e.set;
var d = e.set_attribute;
e.set_checked, e.set_class, e.set_custom_element_data, e.set_default_checked, e.set_default_value, e.set_selected, e.set_style;
var f = e.set_text;
e.set_value, e.set_xlink_attribute, e.setup_stores;
var p = e.sibling;
e.slot, e.snapshot, e.snippet, e.spread_props, e.state, e.stopImmediatePropagation, e.stopPropagation, e.store_get, e.store_mutate, e.store_set, e.store_unsub, e.strict_equals, e.tag, e.tag_proxy;
var m = e.template_effect;
e.text, e.tick, e.to_array, e.trace, e.track_reactivity_loss, e.transition, e.trusted, e.untrack, e.update, e.update_legacy_props, e.update_pre, e.update_pre_prop, e.update_pre_store, e.update_prop, e.update_store, e.user_effect, e.user_pre_effect, e.validate_binding, e.validate_dynamic_element_tag, e.validate_snippet_args, e.validate_store, e.validate_void_dynamic_element, e.wait, e.window, e.with_script, e.wrap_snippet;
//#endregion
//#region pi-extensions/ask-user/src/web/AskUserToolResult.svelte
var h = a("<li><span> </span> </li>"), g = a("<p data-ui=\"ask-user-answer\" data-dismissed=\"\">Dismissed without an answer</p>"), _ = a("<p data-ui=\"ask-user-answer\" data-custom=\"\"> </p>"), v = a("<p data-ui=\"ask-user-answer\"> </p>"), y = a("<div data-ui=\"ask-user-result\"><p data-ui=\"ask-user-question\"> </p> <ul data-ui=\"ask-user-options\"></ul> <!></div>");
function b(e, a) {
	l(a, !0);
	let b = r(() => O(D(a.tool.input, "question")) ?? ""), x = r(() => E(a.tool.input, "options").map((e) => O(D(e, "label"))).filter((e) => !!e)), S = r(() => O(D(a.tool.result, "answer"))), C = r(() => D(a.tool.result, "cancelled") === !0), w = r(() => D(a.tool.result, "wasCustom") === !0), T = r(() => Number(D(a.tool.result, "index")) || 0);
	function E(e, t) {
		let n = D(e, t);
		return Array.isArray(n) ? n : [];
	}
	function D(e, t) {
		if (!(!e || typeof e != "object")) return e[t];
	}
	function O(e) {
		if (typeof e == "string" || typeof e == "number") return String(e);
	}
	var k = y(), A = n(k), j = n(A, !0);
	u(A);
	var M = p(A, 2);
	i(M, 22, () => o(x), (e) => e, (e, r, i) => {
		var a = h(), s = n(a), c = n(s);
		u(s);
		var l = p(s);
		u(a), m(() => {
			d(a, "data-selected", o(S) === r || o(T) === o(i) + 1 || void 0), f(c, `${o(i) + 1}.`), f(l, ` ${r ?? ""}`);
		}), t(e, a);
	}), u(M);
	var N = p(M, 2), P = (e) => {
		t(e, g());
	}, F = (e) => {
		var r = _(), i = n(r, !0);
		u(r), m(() => f(i, o(S))), t(e, r);
	}, I = (e) => {
		var r = v(), i = n(r, !0);
		u(r), m(() => f(i, o(S))), t(e, r);
	};
	s(N, (e) => {
		o(C) || o(S) === void 0 ? e(P) : o(w) ? e(F, 1) : e(I, -1);
	}), u(k), m(() => f(j, o(b))), t(e, k), c();
}
//#endregion
//#region pi-extensions/ask-user/src/web/index.ts
var x = {
	id: "ask-user",
	labels: { ask_user: "Ask the user" },
	parametersFor: (e, t) => e === "ask_user" ? t.filter(([e]) => e === "question") : t,
	resultFor: (e) => e === "ask_user" ? b : void 0
};
//#endregion
export { x as gizmoWebExtension };
