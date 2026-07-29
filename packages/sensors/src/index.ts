// Types

export { BaseSensor } from "./impl/base-sensor.js";

// Core
export { DefaultSensorManager } from "./impl/sensor-manager.js";
export { AudioSensor, type AudioState } from "./impl/sensors/audio-sensor.js";
export {
  BatterySensor,
  type BatteryState,
} from "./impl/sensors/battery-sensor.js";
export {
  ClipboardSensor,
  type ClipboardState,
} from "./impl/sensors/clipboard-sensor.js";
export {
  type DockerContainer,
  type DockerEvent,
  DockerSensor,
  type DockerState,
} from "./impl/sensors/docker-sensor.js";
export {
  type FileChangeEvent,
  FileSystemSensor,
  type FileSystemState,
} from "./impl/sensors/filesystem-sensor.js";
// Sensors
export {
  type GitEvent,
  GitSensor,
  type GitState,
} from "./impl/sensors/git-sensor.js";
export { IdleSensor, type IdleState } from "./impl/sensors/idle-sensor.js";
export {
  type K8sEvent,
  type K8sPod,
  KubernetesSensor,
  type KubernetesState,
} from "./impl/sensors/kubernetes-sensor.js";
export {
  type NotificationEvent,
  NotificationSensor,
  type NotificationState,
} from "./impl/sensors/notification-sensor.js";
export {
  SpotifySensor,
  type SpotifyState,
} from "./impl/sensors/spotify-sensor.js";
export {
  SSHSensor,
  type SSHSession,
  type SSHState,
} from "./impl/sensors/ssh-sensor.js";
export type {
  Sensor,
  SensorCategory,
  SensorConfig,
  SensorEvent,
  SensorId,
  SensorManager,
  SensorManagerState,
  SensorMetadata,
  SensorState,
  SensorStatus,
} from "./types/sensor.js";
