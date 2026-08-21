import { unityDomainPlugin } from '@unity-agent/unity/web';
import type { DomainPlugin } from './plugin';

export const webDomains: readonly DomainPlugin[] = [
	unityDomainPlugin,
	{ id: 'svelte' },
];

export function webDomain(id: string | undefined): DomainPlugin | undefined {
	return webDomains.find((domain) => domain.id === id);
}
