export function configuredOrigins(
	environment: NodeJS.ProcessEnv,
): string[] | undefined {
	const configured = (
		environment.GIZMO_ORIGINS ?? environment.UNITY_AGENT_ORIGINS
	)
		?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	if (configured?.length) return configured;

	const devHost = environment.TAURI_DEV_HOST?.trim();
	if (!devHost) return undefined;
	return [
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		`http://${devHost}:5173`,
		'tauri://localhost',
		'http://tauri.localhost',
	];
}
