import '@gizmo/design';
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

/*
 * `?fake` runs the workspace against the in-memory agent, so the interface can
 * be exercised in a browser without a domain runtime or the sidecar running. The
 * import is dev-only and dynamic, so it never reaches a production bundle.
 */
const useFakeAgent =
	import.meta.env.DEV && new URLSearchParams(location.search).has('fake');

const client = useFakeAgent
	? new (await import('./lib/agent-client/FakeAgentClient')).FakeAgentClient()
	: undefined;

mount(App, {
	target: document.getElementById('app')!,
	...(client ? { props: { client } } : {}),
});
