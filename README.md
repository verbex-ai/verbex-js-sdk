# Verbex Web Client SDK

A TypeScript SDK for building web-based voice AI applications with Verbex AI Agents.

## Installation

```bash
npm install @verbex-ai/verbex-js-sdk
# or
pnpm install @verbex-ai/verbex-js-sdk
# or
yarn add @verbex-ai/verbex-js-sdk
```

## Features

- 🎤 Real-time voice communication with AI agents
- 🔐 Session token-based authentication (JWT from server-side API)
- 📊 Audio stream analysis and visualization
- 📝 Live transcript updates
- 🎯 TypeScript support with full type definitions
- 🔌 Built on LiveKit for reliable WebRTC connections
- 📡 Event-driven architecture
- 🎚️ Microphone mute/unmute controls
- 📈 Volume level calculation

## Quick Start

```typescript
import { VerbexWebClient } from "@verbex-ai/verbex-js-sdk";

// Create client instance
const client = new VerbexWebClient();

// Listen for events
client.on("session_connected", () => {
	console.log("Connected to AI agent!");
});

client.on("session_error", (error) => {
	console.error("Session error:", error);
});

// Start the session with a JWT token from your server
await client.initiateSession({
	sessionToken: "your-jwt-token-from-server",
	audioSampleRate: 24000,
	enableRawAudio: true,
});
```

## Examples

Check out our [examples repository](https://github.com/verbex-ai/verbex-js-sdk-examples) for complete implementation examples:

| Framework | Description | Link |
|-----------|-------------|------|
| Vanilla JavaScript | Pure JavaScript implementation with no framework dependencies | [View Example](https://github.com/verbex-ai/verbex-js-sdk-examples/tree/main/vanilla-js) |
| React | React integration with hooks and component patterns | [View Example](https://github.com/verbex-ai/verbex-js-sdk-examples/tree/main/react) |
| Vue | Vue.js implementation with composition API | [View Example](https://github.com/verbex-ai/verbex-js-sdk-examples/tree/main/vue) |
| Next.js | Next.js App Router implementation with SSR support | [View Example](https://github.com/verbex-ai/verbex-js-sdk-examples/tree/main/nextjs) |

Each example includes:
- Basic voice chat implementation
- Audio visualization
- Transcript display
- Device selection UI
- Error handling patterns

## API Reference

### VerbexWebClient

The main client class for connecting to Verbex AI agents.

#### Constructor

```typescript
const client = new VerbexWebClient();
```

#### Properties

| Property          | Type             | Description                                    |
| ----------------- | ---------------- | ---------------------------------------------- |
| `isAgentSpeaking` | `boolean`        | Whether the agent is currently speaking        |
| `audioAnalyzer`   | `AudioAnalyzer?` | Audio analyzer instance (if raw audio enabled) |

#### Methods

##### `initiateSession(config: SessionConfig): Promise<void>`

Initiates a voice session with the AI agent.

```typescript
await client.initiateSession({
	sessionToken: "jwt-token", // Required: JWT from server-side API
	audioSampleRate: 24000, // Optional: Sample rate (default: 24000)
	inputDeviceId: "device-id", // Optional: Microphone device ID
	outputDeviceId: "device-id", // Optional: Speaker device ID
	enableRawAudio: true, // Optional: Enable audio stream events
});
```

##### `terminateSession(): void`

Terminates the current session and cleans up resources.

```typescript
client.terminateSession();
```

##### `mute(): void`

Mutes the local microphone.

```typescript
client.mute();
```

##### `unmute(): void`

Unmutes the local microphone.

```typescript
client.unmute();
```

### Session Configuration

```typescript
interface SessionConfig {
	sessionToken: string; // JWT token from server-side create-web-session API (required)
	audioSampleRate?: number; // Sample rate for raw audio analysis (default: 24000)
	inputDeviceId?: string; // Microphone device ID
	outputDeviceId?: string; // Speaker device ID
	enableRawAudio?: boolean; // Enable audio_stream events and audioAnalyzer
}
```

### AudioAnalyzer

The `AudioAnalyzer` class provides audio analysis capabilities when `enableRawAudio` is set to `true`.

#### Methods

##### `getPCMFrame(): Float32Array`

Returns the latest PCM audio frame.

```typescript
const pcmData = client.audioAnalyzer?.getPCMFrame();
```

##### `calculateVolume(): number`

Calculates the current volume level (0-1) using RMS calculation.

```typescript
const volume = client.audioAnalyzer?.calculateVolume();
console.log(`Volume: ${(volume * 100).toFixed(0)}%`);
```

##### `cleanup(): Promise<void>`

Cleans up audio resources. Called automatically on session termination.

## Events

The SDK emits the following events:

| Event                          | Payload                    | Description                      |
| ------------------------------ | -------------------------- | -------------------------------- |
| `session_connected`            | `void`                     | Session successfully connected   |
| `session_disconnected`         | `void`                     | Session ended                    |
| `session_error`                | `unknown`                  | An error occurred                |
| `microphone_permission_denied` | `{ error: Error }`         | Microphone permission was denied |
| `agent_speech_started`         | `void`                     | Agent started speaking           |
| `agent_speech_ended`           | `void`                     | Agent stopped speaking           |
| `transcript_updated`           | `TranscriptUpdatedPayload` | New transcript available         |
| `session_metadata`             | `SessionMetadataPayload`   | Session metadata received        |
| `audio_stream`                 | `Float32Array`             | Raw audio PCM data (if enabled)  |
| `connection_lost`              | `void`                     | Connection temporarily lost      |
| `connection_restored`          | `void`                     | Connection re-established        |

## Usage Examples

### Handling Transcripts

```typescript
client.on("transcript_updated", (payload) => {
	payload.transcript.forEach((entry) => {
		console.log(`${entry.role}: ${entry.content}`);
	});
});
```

### Audio Visualization

```typescript
// Enable raw audio in session config
await client.initiateSession({
	sessionToken: "your-jwt-token",
	enableRawAudio: true,
	audioSampleRate: 24000,
});

// Listen for audio stream
client.on("audio_stream", (pcmData: Float32Array) => {
	// pcmData contains raw PCM audio samples
	visualizeAudio(pcmData);
});

// Or use the volume calculation
function updateVolumeIndicator() {
	if (client.audioAnalyzer) {
		const volume = client.audioAnalyzer.calculateVolume();
		updateUI(volume);
	}
	requestAnimationFrame(updateVolumeIndicator);
}
```

### Agent Speech Detection

```typescript
client.on("agent_speech_started", () => {
	console.log("Agent is speaking...");
	// Update UI to show agent is talking
});

client.on("agent_speech_ended", () => {
	console.log("Agent stopped speaking");
	// Update UI
});
```

### Connection Recovery

```typescript
client.on("connection_lost", () => {
	console.log("Connection lost, reconnecting...");
	// Show reconnecting UI
});

client.on("connection_restored", () => {
	console.log("Connection restored!");
	// Hide reconnecting UI
});
```

### Microphone Permission Handling

```typescript
client.on("microphone_permission_denied", ({ error }) => {
	console.error("Microphone access denied:", error.message);
	// Show permission request UI
});
```

### Mute/Unmute Controls

```typescript
// Mute button handler
muteButton.onclick = () => {
	client.mute();
	muteButton.textContent = "Unmute";
};

// Unmute button handler
unmuteButton.onclick = () => {
	client.unmute();
	unmuteButton.textContent = "Mute";
};
```

### Device Selection

```typescript
// Get available devices
const devices = await navigator.mediaDevices.enumerateDevices();

const audioInputs = devices.filter((d) => d.kind === "audioinput");
const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

// Use specific devices
await client.initiateSession({
	sessionToken: "your-jwt-token",
	inputDeviceId: audioInputs[0].deviceId,
	outputDeviceId: audioOutputs[0].deviceId,
});
```

### Error Handling

```typescript
try {
	await client.initiateSession({
		sessionToken: "your-jwt-token",
	});
} catch (error) {
	if (error.message.includes("sessionToken is required")) {
		console.error("No session token provided");
	} else if (error.message.includes("Microphone permission denied")) {
		console.error("Please allow microphone access");
	} else if (error.message.includes("No microphone device found")) {
		console.error("Please connect a microphone");
	} else if (error.message.includes("Microphone is already in use")) {
		console.error("Close other apps using the microphone");
	} else {
		console.error("Connection error:", error);
	}
}
```

### Cleanup

```typescript
// Terminate the session when done
client.terminateSession();
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import {
	VerbexWebClient,
	SessionConfig,
	VerbexClientEvents,
	TranscriptEntry,
	TranscriptUpdatedPayload,
	SessionMetadataPayload,
	AudioAnalyzer,
} from "@verbex-ai/verbex-js-sdk";
```

## Browser Support

- Chrome/Edge 74+
- Firefox 78+
- Safari 14.1+
- Opera 62+

Requires WebRTC and Web Audio API support.

## Development

### Prerequisites

- Node.js >= 16
- pnpm (recommended) or npm/yarn

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/verbex-ai/verbex-js-sdk.git
cd verbex-js-sdk
pnpm install
```

### Build

Build the SDK:

```bash
pnpm run build
# or
npm run build
```

This will create:

- CommonJS output in `dist/index.js`
- ES Module output in `dist/index.mjs`
- UMD output in `dist/index.umd.js`
- TypeScript declarations in `dist/index.d.ts`

### Publishing

Before publishing, ensure all tests pass and the build is successful:

```bash
# Build the package
pnpm run build

# Publish to npm (requires npm organization access)
npm publish
```

The `prepublishOnly` script will automatically build the package before publishing.

## License

ISC

## Support

For issues and questions:

- GitHub Issues: [https://github.com/verbex-ai/verbex-js-sdk/issues](https://github.com/verbex-ai/verbex-js-sdk/issues)
- Documentation: [https://docs.verbex.ai](https://docs.verbex.ai)
- Email: support@verbex.ai
