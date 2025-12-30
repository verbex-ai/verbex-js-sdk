import EventEmitter from "eventemitter3";
import {
	Room,
	RoomEvent,
	Track,
	RemoteAudioTrack,
	RemoteParticipant,
	Participant,
	TrackPublication,
} from "livekit-client";

import type { TranscriptionSegment } from "livekit-client";

import {
	AudioAnalyzer,
	createAudioAnalyzerFromLiveKitTrack,
} from "./audioAnalyzer";
import {
	SessionConfig,
	VerbexClientEvents,
	TranscriptUpdatedPayload,
} from "./types";

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
class TypedEventEmitter extends EventEmitter {
	/**
	 * Type-safe event listener registration.
	 * Ensures the handler function receives the correct payload type for each event.
	 */
	on<K extends keyof VerbexClientEvents>(
		event: K,
		fn: (payload: VerbexClientEvents[K]) => void
	): this;
	on(event: string | symbol, fn: (...args: any[]) => void, context?: any): this;
	on(event: any, fn: any, context?: any): this {
		return super.on(event, fn, context);
	}

	/**
	 * Type-safe event emission.
	 * Ensures the payload matches the expected type for each event.
	 */
	emit<K extends keyof VerbexClientEvents>(
		event: K,
		payload?: VerbexClientEvents[K]
	): boolean;
	emit(event: string | symbol, ...args: any[]): boolean;
	emit(event: any, ...args: any[]): boolean {
		return super.emit(event as string, ...args);
	}
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
export class VerbexWebClient extends TypedEventEmitter {
	/**
	 * Indicates whether the AI agent is currently speaking.
	 * Use this to show visual indicators in your UI.
	 */
	public isAgentSpeaking = false;

	/**
	 * Audio analyzer instance for real-time audio analysis.
	 * Only available when enableRawAudio: true in session config.
	 * Use this to get PCM data or calculate volume levels.
	 */
	public audioAnalyzer?: AudioAnalyzer;

	/**
	 * LiveKit Room instance managing the WebRTC connection.
	 * @private
	 */
	private room?: Room;

	/**
	 * Connection state flag to prevent duplicate operations.
	 * @private
	 */
	private connected = false;

	/**
	 * requestAnimationFrame ID for audio frame capture loop.
	 * Used to continuously emit audio_stream events.
	 * @private
	 */
	private captureAudioFrame?: number;

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
	public async initiateSession(config: SessionConfig): Promise<void> {
		try {
			// If already connected, terminate existing session before starting new one
			if (this.connected) this.terminateSession();

			// Validate required sessionToken
			if (!config.sessionToken) {
				throw new Error(
					"sessionToken is required. Provide sessionToken in config."
				);
			}

			// Request microphone permission explicitly BEFORE LiveKit connection
			// This gives us better error handling and a cleaner user experience
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});

				// Stop the test stream immediately
				// LiveKit will request microphone access again with proper constraints
				stream.getTracks().forEach((track) => track.stop());
			} catch (permissionError: any) {
				// Handle specific microphone error types with user-friendly messages

				if (
					permissionError.name === "NotAllowedError" ||
					permissionError.name === "PermissionDeniedError"
				) {
					// User denied permission in browser prompt
					const error = new Error(
						"Microphone permission denied. Please allow microphone access to continue."
					);
					this.emit("microphone_permission_denied", { error });
					throw error;
				} else if (permissionError.name === "NotFoundError") {
					// No microphone hardware detected
					const error = new Error(
						"No microphone device found. Please connect a microphone."
					);
					throw error;
				} else if (permissionError.name === "NotReadableError") {
					// Microphone is being used by another application
					const error = new Error(
						"Microphone is already in use by another application."
					);
					throw error;
				}

				// Unknown error, re-throw as-is
				throw permissionError;
			}

			const tokenToUse = config.sessionToken;

			// LiveKit WebSocket URL for the voice AI platform
			// This is the server endpoint that manages WebRTC connections
			const url = "wss://pia-platform-dev-k9sck0q7.livekit.cloud";

			// Create LiveKit Room instance with audio device configuration
			this.room = new Room({
				audioCaptureDefaults: {
					// Use specified input device or browser default
					deviceId: config.inputDeviceId,
				},
				audioOutput: {
					// Use specified output device or browser default
					deviceId: config.outputDeviceId,
				},
			});

			// Bind event handlers for room events, data messages, and audio tracks
			// These must be set up BEFORE connecting to ensure we don't miss any events
			this.bindRoomEvents();
			this.bindDataEvents();
			this.bindAudioEvents(config);

			// Establish WebRTC connection to the LiveKit server
			await this.room.connect(url, tokenToUse);

			// Enable and publish local microphone track so the agent can hear the user
			await this.room.localParticipant.setMicrophoneEnabled(true);

			// Mark as connected and notify listeners
			this.connected = true;
			this.emit("session_connected");
		} catch (err) {
			// On any error, emit session_error event, clean up, and re-throw
			this.emit("session_error", err);
			this.terminateSession();
			throw err;
		}
	}

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
	public terminateSession(): void {
		// Remember if we were connected (to emit event later)
		const wasConnected = this.connected;

		// Reset state flags
		this.connected = false;
		this.isAgentSpeaking = false;

		// Stop audio frame capture loop
		if (this.captureAudioFrame) {
			globalThis.cancelAnimationFrame(this.captureAudioFrame);
			this.captureAudioFrame = undefined;
		}

		// Clean up audio analyzer resources
		if (this.audioAnalyzer) {
			this.audioAnalyzer.cleanup();
			this.audioAnalyzer = undefined;
		}

		// Disconnect from LiveKit room
		if (this.room) {
			this.room.disconnect().catch(() => {
				// Ignore disconnect errors - we're cleaning up anyway
			});
			this.room = undefined;
		}

		// Emit disconnected event only if we were previously connected
		if (wasConnected) {
			this.emit("session_disconnected");
		}
	}

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
	public mute(): void {
		if (this.connected && this.room) {
			this.room.localParticipant.setMicrophoneEnabled(false);
		}
	}

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
	public unmute(): void {
		if (this.connected && this.room) {
			this.room.localParticipant.setMicrophoneEnabled(true);
		}
	}

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
	private bindRoomEvents() {
		if (!this.room) return;

		// Handle room disconnection
		// This can happen due to network issues, server shutdown, or intentional disconnect
		this.room.on(RoomEvent.Disconnected, () => {
			if (this.connected) this.terminateSession();
		});

		// Handle reconnection attempts
		// LiveKit automatically attempts to reconnect when connection is lost
		this.room.on(RoomEvent.Reconnecting, () => {
			this.emit("connection_lost");
		});

		// Handle successful reconnection
		// Session continues where it left off
		this.room.on(RoomEvent.Reconnected, () => {
			this.emit("connection_restored");
		});

		// Handle participant disconnection
		// If the server/agent disconnects, we should end the session
		this.room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
			// If server/agent drops, treat as session end
			if (p.identity === "server") {
				this.terminateSession();
			}
		});

		// Listen for LiveKit native transcription events
		// These provide real-time speech-to-text transcripts
		this.room.on(
			RoomEvent.TranscriptionReceived,
			(
				segments: TranscriptionSegment[],
				participant?: Participant,
				_publication?: TrackPublication // Prefixed with _ to indicate intentionally unused
			) => {
				// Convert LiveKit TranscriptionSegment format to our internal format
				const transcript = segments.map((segment) => ({
					// Determine if this is from agent or user based on participant identity
					role:
						participant?.identity === "server" ||
						participant?.identity?.includes("agent")
							? ("agent" as const)
							: ("user" as const),
					content: segment.text,
					id: segment.id,
					final: segment.final,
					startTime: segment.startTime,
					endTime: segment.endTime,
				}));

				// Emit transcript update to listeners
				this.emit("transcript_updated", { transcript });
			}
		);
	}

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
	private bindAudioEvents(config: SessionConfig) {
		if (!this.room) return;

		// Listen for new audio tracks being subscribed
		// This fires when the agent starts sending audio
		this.room.on(
			RoomEvent.TrackSubscribed,
			async (track, _publication, _participant) => {
				// Only handle audio tracks (ignore video or other track types)
				if (track.kind !== Track.Kind.Audio) return;

				// Attach track for playback
				// LiveKit automatically creates and manages the HTML audio element
				// This allows the user to hear the agent's voice
				track.attach();

				// If raw audio analysis is enabled, set up the audio analyzer
				if (config.enableRawAudio && track instanceof RemoteAudioTrack) {
					try {
						// Create audio analyzer from the remote audio track
						this.audioAnalyzer = await createAudioAnalyzerFromLiveKitTrack(
							track,
							config.audioSampleRate ?? 24000
						);

						// Start the continuous audio sampling loop
						this.captureAudioSamples();
					} catch (err) {
						// If audio analyzer fails to initialize, emit error but continue session
						this.emit("session_error", err);
					}
				}
			}
		);
	}

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
	private captureAudioSamples() {
		// Stop if session ended or analyzer was cleaned up
		if (!this.connected || !this.audioAnalyzer) return;

		// Get the latest PCM audio frame from the analyzer
		const pcm = this.audioAnalyzer.getPCMFrame();

		// Emit the raw audio data to listeners
		this.emit("audio_stream", pcm);

		// Schedule next frame capture using requestAnimationFrame
		// This runs at the browser's refresh rate for smooth visualization
		this.captureAudioFrame = globalThis.requestAnimationFrame(() =>
			this.captureAudioSamples()
		);
	}

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
	private bindDataEvents() {
		if (!this.room) return;

		// Listen for data messages sent via LiveKit's data channel
		// These are custom messages from the Verbex server/agent
		this.room.on(
			RoomEvent.DataReceived,
			(payload, _participant, _kind, _topic) => {
				// Try to decode and parse the payload as JSON
				let event: any;
				try {
					const decoded = new TextDecoder().decode(payload);
					event = JSON.parse(decoded);
				} catch {
					// Invalid JSON payload - silently ignore and skip processing
					// This prevents errors from non-JSON or corrupted data
					return;
				}

				try {
					/**
					 * Server Event Protocol:
					 *
					 * Expected event types from the Verbex server:
					 * - "metadata": Session initialization data (IDs, config, etc.)
					 * - "update": Transcript updates with conversation history
					 * - "agent_start_talking": Agent begins speaking
					 * - "agent_stop_talking": Agent stops speaking
					 *
					 * We normalize these server events to our SDK's event contract.
					 */

					// Extract event type (supports multiple field name variations for compatibility)
					const eventType =
						event.event_type || event.type || event.eventType || event.event;

					// Route events based on type
					switch (eventType) {
						case "metadata": {
							// Session metadata received (session ID, agent info, etc.)
							this.emit("session_metadata", event);
							break;
						}

						case "update": {
							// Transcript update received
							// Normalize different possible field names for transcript data
							const transcriptPayload: TranscriptUpdatedPayload = {
								transcript:
									event.transcript || event.transcripts || event.messages || [],
							};

							this.emit("transcript_updated", transcriptPayload);
							break;
						}

						case "agent_start_talking": {
							// Agent started speaking - update state and emit event
							this.isAgentSpeaking = true;
							this.emit("agent_speech_started");
							break;
						}

						case "agent_stop_talking": {
							// Agent stopped speaking - update state and emit event
							this.isAgentSpeaking = false;
							this.emit("agent_speech_ended");
							break;
						}

						default:
							// Unknown event type - silently ignore
							// This allows the server to send new event types without breaking the SDK
							break;
					}
				} catch (err) {
					// Error processing data event - log but don't emit to avoid noise
					console.warn("[Verbex SDK] Error processing data event:", err);
				}
			}
		);
	}
}

// Re-export all types and utilities for consumer convenience
export * from "./types";
export * from "./audioAnalyzer";
