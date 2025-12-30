import EventEmitter from "eventemitter3";
import { AudioAnalyzer } from "./audioAnalyzer";
import { SessionConfig, VerbexClientEvents } from "./types";
/**
 * Type-safe EventEmitter wrapper that provides compile-time checking for event names and payloads.
 *
 * This class extends EventEmitter3 to add TypeScript type safety for the Verbex event system.
 * It ensures that:
 * - Event names are from the VerbexClientEvents interface
 * - Event handlers receive correctly typed payloads
 * - IDE autocomplete works for event names
 *
 * @internal This class is not exported and is used as a base for VerbexWebClient
 */
declare class TypedEventEmitter extends EventEmitter {
    /**
     * Type-safe event listener registration.
     * Ensures the handler function receives the correct payload type for each event.
     */
    on<K extends keyof VerbexClientEvents>(event: K, fn: (payload: VerbexClientEvents[K]) => void): this;
    on(event: string | symbol, fn: (...args: any[]) => void, context?: any): this;
    /**
     * Type-safe event emission.
     * Ensures the payload matches the expected type for each event.
     */
    emit<K extends keyof VerbexClientEvents>(event: K, payload?: VerbexClientEvents[K]): boolean;
    emit(event: string | symbol, ...args: any[]): boolean;
}
/**
 * VerbexWebClient is the main SDK class for building voice AI applications with Verbex.
 *
 * This client handles:
 * - WebRTC-based real-time voice communication with AI agents
 * - Session management (connection, reconnection, cleanup)
 * - Audio capture and playback
 * - Transcript streaming and updates
 * - Audio analysis and visualization
 * - Error handling and recovery
 *
 * Built on LiveKit for reliable, low-latency voice communication.
 *
 * @example
 * ```typescript
 * import { VerbexWebClient } from "@verbex-ai/verbex-js-sdk";
 *
 * const client = new VerbexWebClient();
 *
 * // Listen for events
 * client.on("session_connected", () => console.log("Connected!"));
 * client.on("transcript_updated", ({ transcript }) => console.log(transcript));
 *
 * // Start session
 * await client.initiateSession({
 *   sessionToken: "your-jwt-token",
 *   enableRawAudio: true
 * });
 * ```
 */
export declare class VerbexWebClient extends TypedEventEmitter {
    /**
     * Indicates whether the AI agent is currently speaking.
     * Use this to show visual indicators in your UI.
     */
    isAgentSpeaking: boolean;
    /**
     * Audio analyzer instance for real-time audio analysis.
     * Only available when enableRawAudio: true in session config.
     * Use this to get PCM data or calculate volume levels.
     */
    audioAnalyzer?: AudioAnalyzer;
    /**
     * LiveKit Room instance managing the WebRTC connection.
     * @private
     */
    private room?;
    /**
     * Connection state flag to prevent duplicate operations.
     * @private
     */
    private connected;
    /**
     * requestAnimationFrame ID for audio frame capture loop.
     * Used to continuously emit audio_stream events.
     * @private
     */
    private captureAudioFrame?;
    /**
     * Initiates a voice session with the Verbex AI agent.
     *
     * This method:
     * 1. Validates the session token
     * 2. Requests microphone permissions
     * 3. Establishes a WebRTC connection via LiveKit
     * 4. Sets up audio capture and playback
     * 5. Configures event handlers for transcripts, audio, and connection states
     *
     * On success, emits 'session_connected' event.
     * On error, emits 'session_error' and cleans up resources.
     *
     * @param config - Session configuration (see SessionConfig interface)
     * @throws {Error} If sessionToken is not provided
     * @throws {Error} If microphone permission is denied
     * @throws {Error} If no microphone is found
     * @throws {Error} If microphone is already in use
     * @throws {Error} If connection to LiveKit fails
     *
     * @example
     * ```typescript
     * try {
     *   await client.initiateSession({
     *     sessionToken: "your-jwt-token",
     *     audioSampleRate: 24000,
     *     enableRawAudio: true
     *   });
     * } catch (error) {
     *   console.error("Failed to start session:", error);
     * }
     * ```
     */
    initiateSession(config: SessionConfig): Promise<void>;
    /**
     * Terminates the current voice session and cleans up all resources.
     *
     * This method:
     * 1. Stops audio frame capture
     * 2. Cleans up the audio analyzer
     * 3. Disconnects from LiveKit
     * 4. Resets internal state
     * 5. Emits 'session_disconnected' event (if was connected)
     *
     * Safe to call multiple times - will only clean up once.
     * Safe to call even if session was never started.
     *
     * @example
     * ```typescript
     * // When user clicks "End Call" button
     * client.terminateSession();
     * ```
     */
    terminateSession(): void;
    /**
     * Mutes the local microphone.
     * The user's audio will no longer be sent to the AI agent.
     *
     * Note: The agent can still speak and the user can still hear responses.
     *
     * @example
     * ```typescript
     * // Mute button handler
     * muteButton.onclick = () => {
     *   client.mute();
     *   muteButton.textContent = "Unmute";
     * };
     * ```
     */
    mute(): void;
    /**
     * Unmutes the local microphone.
     * The user's audio will be sent to the AI agent again.
     *
     * @example
     * ```typescript
     * // Unmute button handler
     * unmuteButton.onclick = () => {
     *   client.unmute();
     *   unmuteButton.textContent = "Mute";
     * };
     * ```
     */
    unmute(): void;
    /**
     * Binds LiveKit room event handlers for connection lifecycle management.
     *
     * Handles:
     * - Disconnection (normal and unexpected)
     * - Reconnection attempts and restoration
     * - Participant disconnection (especially server/agent)
     * - Native LiveKit transcription events
     *
     * @private
     */
    private bindRoomEvents;
    /**
     * Binds audio track event handlers.
     *
     * Handles:
     * - Audio track subscription (when agent's audio becomes available)
     * - Audio playback setup
     * - Audio analyzer initialization (if enableRawAudio is true)
     *
     * @param config - Session configuration containing audio settings
     * @private
     */
    private bindAudioEvents;
    /**
     * Continuously captures audio samples and emits them as events.
     *
     * This method runs in a requestAnimationFrame loop, providing audio data
     * at the browser's refresh rate (~60fps).
     *
     * Emits 'audio_stream' events with Float32Array PCM data for:
     * - Audio visualization (waveforms, spectrums)
     * - Volume meters
     * - Custom audio analysis
     *
     * @private
     */
    private captureAudioSamples;
    /**
     * Binds data channel event handlers for custom server messages.
     *
     * Handles server-sent events via LiveKit's data channel:
     * - Session metadata
     * - Transcript updates
     * - Agent speech state changes
     *
     * This method normalizes different event formats and emits standardized Verbex events.
     *
     * @private
     */
    private bindDataEvents;
}
export * from "./types";
export * from "./audioAnalyzer";
//# sourceMappingURL=index.d.ts.map