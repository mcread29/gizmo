use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct AgentSidecar(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let (_events, child) = app
                .shell()
                .sidecar("unity-agent-server")?
                .env("UNITY_AGENT_DATA_DIR", data_dir)
                .env("UNITY_AGENT_HOST", "127.0.0.1")
                .env("UNITY_AGENT_PORT", "8787")
                .spawn()?;
            if !wait_for_agent() {
                let _ = child.kill();
                return Err("Unity Agent sidecar did not start on port 8787".into());
            }
            app.manage(AgentSidecar(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Unity Agent")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(child) = app.state::<AgentSidecar>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}

fn wait_for_agent() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], 8787));
    for _ in 0..100 {
        if TcpStream::connect_timeout(&address, Duration::from_millis(50)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(50));
    }
    false
}
