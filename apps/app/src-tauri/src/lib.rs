use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct AgentSidecar(Mutex<Option<CommandChild>>);

/// Picks a location and writes the text there. Kept in Rust so the write is
/// scoped to the file the user just chose, rather than opening the filesystem
/// to the web layer. Returns None when the dialog is dismissed.
#[tauri::command]
async fn save_text_file(
    app: AppHandle,
    suggested_name: String,
    contents: String,
) -> Result<Option<String>, String> {
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(&suggested_name)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|error| error.to_string())?;
    std::fs::write(&path, contents).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn pick_workspace_directory(app: AppHandle) -> Result<Option<String>, String> {
    let Some(path) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = path.into_path().map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_text_file,
            pick_workspace_directory
        ])
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let (_events, child) = app
                .shell()
                .sidecar("gizmo-server")?
                .env("GIZMO_DATA_DIR", data_dir)
                .env("GIZMO_HOST", "127.0.0.1")
                .env("GIZMO_PORT", "8787")
                .spawn()?;
            if !wait_for_agent() {
                let _ = child.kill();
                return Err("Gizmo sidecar did not start on port 8787".into());
            }
            app.manage(AgentSidecar(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Gizmo")
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
