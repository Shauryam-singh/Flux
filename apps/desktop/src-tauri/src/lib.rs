use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct ApiState {
    api_url: Mutex<String>,
}

struct RecordingState {
    child: Mutex<Option<Child>>,
    temp_path: Mutex<PathBuf>,
}

#[tauri::command]
fn send_message(message: String, state: tauri::State<ApiState>) -> Result<String, String> {
    let api_url = state.api_url.lock().map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

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
fn start_recording(state: tauri::State<RecordingState>) -> Result<String, String> {
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
    let mut temp_lock = state.temp_path.lock().map_err(|e| e.to_string())?;

    if child_lock.is_some() {
        return Err("Already recording".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("flux_recording_{}.wav", std::process::id()));

    let child = Command::new("arecord")
        .args([
            "-f", "S16_LE",
            "-r", "16000",
            "-c", "1",
            "-t", "wav",
            file_path.to_str().unwrap_or("/tmp/flux_rec.wav"),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start recording: {}. Is arecord installed?", e))?;

    *child_lock = Some(child);
    *temp_lock = file_path;

    Ok("recording_started".to_string())
}

#[tauri::command]
fn stop_recording(
    rec_state: tauri::State<RecordingState>,
    api_state: tauri::State<ApiState>,
) -> Result<String, String> {
    let mut child_lock = rec_state.child.lock().map_err(|e| e.to_string())?;
    let temp_lock = rec_state.temp_path.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = child_lock.take() {
        let _ = child.kill();
        let _ = child.wait();
    } else {
        return Err("Not recording".to_string());
    }

    let file_path = temp_lock.clone();

    // Wait briefly for file to flush
    std::thread::sleep(std::time::Duration::from_millis(100));

    let audio_bytes = fs::read(&file_path).map_err(|e| format!("Failed to read audio: {}", e))?;
    let _ = fs::remove_file(&file_path);

    if audio_bytes.len() < 100 {
        return Err("Recording too short".to_string());
    }

    let audio_b64 = base64_encode(&audio_bytes);

    let api_url = api_state.api_url.lock().map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(format!("{}/voice/transcribe", *api_url))
        .json(&serde_json::json!({
            "audio": audio_b64,
            "sampleRate": 16000
        }))
        .send()
        .map_err(|e| e.to_string())?;

    let body: serde_json::Value = response.json().map_err(|e| e.to_string())?;

    body["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No transcription result".to_string())
}

#[tauri::command]
fn speak(text: String, state: tauri::State<ApiState>) -> Result<String, String> {
    let api_url = state.api_url.lock().map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(format!("{}/voice/speak", *api_url))
        .json(&serde_json::json!({ "text": text }))
        .send()
        .map_err(|e| e.to_string())?;

    let audio_bytes = response.bytes().map_err(|e| e.to_string())?;

    if audio_bytes.is_empty() {
        return Ok("no_audio".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("flux_speak_{}.wav", std::process::id()));

    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(&audio_bytes)
        .map_err(|e| e.to_string())?;
    drop(file);

    // Play audio using sox 'play' or aplay
    let play_result = Command::new("play")
        .args(["-t", "wav", file_path.to_str().unwrap()])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    if play_result.is_err() {
        // Fallback to aplay
        let _ = Command::new("aplay")
            .arg(file_path.to_str().unwrap())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }

    let _ = fs::remove_file(&file_path);

    Ok("spoken".to_string())
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let api_state = ApiState {
        api_url: Mutex::new("http://localhost:3141".to_string()),
    };

    let recording_state = RecordingState {
        child: Mutex::new(None),
        temp_path: Mutex::new(std::env::temp_dir().join("flux_recording.wav")),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(api_state)
        .manage(recording_state)
        .invoke_handler(tauri::generate_handler![
            send_message,
            start_recording,
            stop_recording,
            speak,
        ])
        .setup(|app| {
            // Check if API is already running
            let client = reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(2))
                .build()
                .unwrap_or_default();

            let already_running = client
                .get("http://localhost:3141/health")
                .send()
                .is_ok();

            if already_running {
                return Ok(());
            }

            // Find the API server relative to the desktop app
            let resource_dir = app
                .path()
                .resource_dir()
                .ok()
                .or_else(|| {
                    // Fallback: try relative to current executable
                    std::env::current_exe().ok().and_then(|exe| {
                        exe.parent().and_then(|p| p.parent()).map(|p| p.to_path_buf())
                    })
                });

            let api_dir = if let Some(dir) = resource_dir {
                // In production: look for bundled API
                let candidate = dir.join("apps").join("api");
                if candidate.exists() {
                    candidate
                } else {
                    // Dev mode: relative path
                    std::env::current_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                        .join("apps")
                        .join("api")
                }
            } else {
                std::env::current_dir()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .join("apps")
                    .join("api")
            };

            let _ = Command::new("node")
                .args(["dist/index.js"])
                .current_dir(&api_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
