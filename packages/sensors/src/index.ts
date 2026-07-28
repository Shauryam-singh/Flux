// Types
export type {
  Sensor,
  SensorId,
  SensorCategory,
  SensorMetadata,
  SensorState,
  SensorStatus,
  SensorEvent,
  SensorConfig,
  SensorManager,
  SensorManagerState,
} from "./types/sensor.js";

// Core
export { DefaultSensorManager } from "./impl/sensor-manager.js";
export { BaseSensor } from "./impl/base-sensor.js";

// Sensors
export { GitSensor, type GitState, type GitEvent } from "./impl/sensors/git-sensor.js";
export { FileSystemSensor, type FileSystemState, type FileChangeEvent } from "./impl/sensors/filesystem-sensor.js";
export { ClipboardSensor, type ClipboardState } from "./impl/sensors/clipboard-sensor.js";
export { BatterySensor, type BatteryState } from "./impl/sensors/battery-sensor.js";
export { IdleSensor, type IdleState } from "./impl/sensors/idle-sensor.js";
export { NotificationSensor, type NotificationState, type NotificationEvent } from "./impl/sensors/notification-sensor.js";
export { DockerSensor, type DockerState, type DockerContainer, type DockerEvent } from "./impl/sensors/docker-sensor.js";
export { SpotifySensor, type SpotifyState } from "./impl/sensors/spotify-sensor.js";
export { KubernetesSensor, type KubernetesState, type K8sPod, type K8sEvent } from "./impl/sensors/kubernetes-sensor.js";
export { SSHSensor, type SSHState, type SSHSession } from "./impl/sensors/ssh-sensor.js";
export { AudioSensor, type AudioState } from "./impl/sensors/audio-sensor.js";
