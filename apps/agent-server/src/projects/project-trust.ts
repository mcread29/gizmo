/**
 * Whether a workspace's own `.pi` resources may be loaded. Pi asks the user
 * before honouring a project's extensions and settings; this reads the answer
 * it recorded. Outside Pi web mode there is no trust store and Pi loads
 * project resources unconditionally, so the same holds here.
 */
export async function workspaceTrusted(cwd: string): Promise<boolean> {
	if (process.env.GIZMO_PI_WEB !== '1') return true;
	const {
		getAgentDir,
		hasTrustRequiringProjectResources,
		ProjectTrustStore,
		SettingsManager,
	} = await import('@earendil-works/pi-coding-agent');
	if (!hasTrustRequiringProjectResources(cwd)) return true;
	const agentDir = getAgentDir();
	const saved = new ProjectTrustStore(agentDir).get(cwd);
	if (saved !== null) return saved;
	return (
		SettingsManager.create(cwd, agentDir).getDefaultProjectTrust() === 'always'
	);
}
