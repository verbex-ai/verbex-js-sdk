/**
 * Configuration options for initiating a Verbex voice session.
 *
 * @example
 * ```typescript
 * const config: SessionConfig = {
 *   sessionToken: "your-jwt-token",
 *   audioSampleRate: 24000,
 *   enableRawAudio: true,
 *   inputDeviceId: "default",
 *   outputDeviceId: "default"
 * };
 * ```
 */
export interface SessionConfig {
    /**
     * JWT token from server-side create-web-session API.
     * This is the required method for authentication.
     *
     * @required
     * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     */
    sessionToken: string;
    /**
     * Requested sample rate for raw audio analysis (browser may choose otherwise)
     * Higher sample rates provide better quality but consume more resources.
     *
     * @default 24000
     * @example 24000, 48000
     */
    audioSampleRate?: number;
    /**
     * Device ID for the input microphone.
     * Use navigator.mediaDevices.enumerateDevices() to get available device IDs.
     *
     * @optional
     * @example "default" or "abc123deviceid"
     */
    inputDeviceId?: string;
    /**
     * Device ID for the output speaker/headphones.
     * Use navigator.mediaDevices.enumerateDevices() to get available device IDs.
     *
     * @optional
     * @example "default" or "xyz789deviceid"
     */
    outputDeviceId?: string;
    /**
     * Enables raw audio stream events and AudioAnalyzer functionality.
     * Set to true if you need to visualize audio or perform custom audio analysis.
     * Enabling this will emit 'audio_stream' events with PCM data.
     *
     * @default false
     */
    enableRawAudio?: boolean;
}
/**
 * Represents who is speaking in a transcript entry.
 * - "agent": The AI voice agent
 * - "user": The human user
 */
export type TranscriptRole = "agent" | "user";
/**
 * A single transcript entry representing one speaker's message.
 *
 * @example
 * ```typescript
 * const entry: TranscriptEntry = {
 *   role: "user",
 *   content: "Hello, how can you help me today?"
 * };
 * ```
 */
export interface TranscriptEntry {
    /** The speaker's role (agent or user) */
    role: TranscriptRole;
    /** The text content of what was said */
    content: string;
}
/**
 * Payload emitted when transcript is updated.
 * Contains an array of all transcript entries in chronological order.
 *
 * @event transcript_updated
 */
export interface TranscriptUpdatedPayload {
    /** Array of transcript entries */
    transcript: TranscriptEntry[];
}
/**
 * Session metadata emitted from server.
 * This is a flexible type that can contain any server-provided metadata.
 * Common fields may include session ID, agent info, timestamps, etc.
 *
 * @event session_metadata
 * @example
 * ```typescript
 * {
 *   sessionId: "sess_123",
 *   agentId: "agent_456",
 *   startTime: 1234567890
 * }
 * ```
 */
export type SessionMetadataPayload = Record<string, any>;
/**
 * All SDK events and their payload types.
 * Use this interface for type-safe event handling.
 *
 * @example
 * ```typescript
 * client.on("session_connected", () => {
 *   console.log("Connected!");
 * });
 *
 * client.on("transcript_updated", (payload) => {
 *   // payload is automatically typed as TranscriptUpdatedPayload
 *   console.log(payload.transcript);
 * });
 * ```
 */
export interface VerbexClientEvents {
    /**
     * Emitted when session is successfully connected and ready.
     * You can now send/receive audio and the agent is listening.
     */
    session_connected: void;
    /**
     * Emitted when session is disconnected (normally or due to error).
     * All resources have been cleaned up at this point.
     */
    session_disconnected: void;
    /**
     * Emitted when microphone permission is denied by the user.
     * Handle this to show appropriate UI and guide user to enable permissions.
     */
    microphone_permission_denied: {
        error: Error;
    };
    /**
     * Emitted when the AI agent starts speaking.
     * Use this to show visual indicators like "Agent is speaking..."
     */
    agent_speech_started: void;
    /**
     * Emitted when the AI agent stops speaking.
     * The agent is now listening for user input.
     */
    agent_speech_ended: void;
    /**
     * Emitted when transcript is updated with new or modified entries.
     * Contains the full conversation history up to this point.
     */
    transcript_updated: TranscriptUpdatedPayload;
    /**
     * Emitted when session metadata is received from server.
     * This can contain custom data specific to your implementation.
     */
    session_metadata: SessionMetadataPayload;
    /**
     * Emitted when raw audio PCM data is available (only if enableRawAudio: true).
     * Contains Float32Array of audio samples for visualization or analysis.
     * This event fires continuously at the browser's animation frame rate.
     */
    audio_stream: Float32Array;
    /**
     * Emitted when any error occurs during the session.
     * The session may or may not be terminated depending on the error.
     */
    session_error: unknown;
    /**
     * Emitted when connection is temporarily lost (e.g., network issues).
     * SDK will automatically attempt to reconnect.
     */
    connection_lost: void;
    /**
     * Emitted when connection is successfully restored after being lost.
     * Session continues where it left off.
     */
    connection_restored: void;
}
/**
 * Helper type to extract the payload type for a specific event.
 * Useful for creating type-safe event handlers.
 *
 * @example
 * ```typescript
 * type TranscriptPayload = EventPayload<"transcript_updated">;
 * // TranscriptPayload is now TranscriptUpdatedPayload
 * ```
 */
export type EventPayload<K extends keyof VerbexClientEvents> = VerbexClientEvents[K];
//# sourceMappingURL=types.d.ts.map