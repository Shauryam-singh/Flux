use std::process::{Command, Stdio};
use std::sync::Mutex;

struct ApiState {
    api_url: Mutex<String>,
}

#[tauri::command]
fn send_message(message: String, state: tauri::State<ApiState>) -> Result<String, String> {
    let api_url = state.api_url.lock().map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::new();
    let response = client
        .post(format!("{}/chat", *api_url))
        .json(&serde_json::json!({ "message": message }))
        .send()
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = response.json().map_err(|e| e.to_string())?;
    body["reply"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No reply from API".to_string())
}

#[tauri::command]
fn start_recording() -> Result<String, String> {
    Ok("recording_started".to_string())
}

#[tauri::command]
fn stop_recording() -> Result<String, String> {
    Ok("".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api_state = ApiState {
        api_url: Mutex::new("http://localhost:3141".to_string()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(api_state)
        .invoke_handler(tauri::generate_handler![
            send_message,
            start_recording,
            stop_recording,
        ])
        .setup(|app| {
            // Start the API server in the background
            let _ = Command::new("node")
                .args(["dist/index.js"])
                .current_dir("../../apps/api")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
