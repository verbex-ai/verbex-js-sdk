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
 * Strongly typed EventEmitter wrapper
 */
class TypedEventEmitter extends EventEmitter {
	on<K extends keyof VerbexClientEvents>(
		event: K,
		fn: (payload: VerbexClientEvents[K]) => void
	): this;
	on(event: string | symbol, fn: (...args: any[]) => void, context?: any): this;
	on(event: any, fn: any, context?: any): this {
		return super.on(event as string, fn as any, context);
	}

	emit<K extends keyof VerbexClientEvents>(
		event: K,
		payload?: VerbexClientEvents[K]
	): boolean;
	emit(event: string | symbol, ...args: any[]): boolean;
	emit(event: any, ...args: any[]): boolean {
		return super.emit(event as string, ...args);
	}
}

export class VerbexWebClient extends TypedEventEmitter {
	public isAgentSpeaking = false;
	public audioAnalyzer?: AudioAnalyzer;

	private room?: Room;
	private connected = false;
	private captureAudioFrame?: number;

	/**
	 * Initiates the session using LiveKit.
	 *
	 * @param config - Session configuration including sessionToken (JWT from server-side API)
	 * @throws {Error} If sessionToken is not provided
	 */
	public async initiateSession(config: SessionConfig): Promise<void> {
		try {
			if (this.connected) this.terminateSession();

			if (!config.sessionToken) {
				throw new Error(
					"sessionToken is required. Provide sessionToken in config."
				);
			}

			// Request microphone permission explicitly before LiveKit connection
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				// Stop the test stream - LiveKit will request again with proper settings
				stream.getTracks().forEach((track) => track.stop());
			} catch (permissionError: any) {
				// Handle specific permission errors
				if (
					permissionError.name === "NotAllowedError" ||
					permissionError.name === "PermissionDeniedError"
				) {
					const error = new Error(
						"Microphone permission denied. Please allow microphone access to continue."
					);
					this.emit("microphone_permission_denied", { error });
					throw error;
				} else if (permissionError.name === "NotFoundError") {
					const error = new Error(
						"No microphone device found. Please connect a microphone."
					);
					throw error;
				} else if (permissionError.name === "NotReadableError") {
					const error = new Error(
						"Microphone is already in use by another application."
					);
					throw error;
				}
				throw permissionError;
			}

			const tokenToUse = config.sessionToken;

			// Use default WebSocket URL
			const url = "wss://pia-platform-dev-k9sck0q7.livekit.cloud";

			this.room = new Room({
				audioCaptureDefaults: {
					deviceId: config.inputDeviceId,
				},
				audioOutput: {
					deviceId: config.outputDeviceId,
				},
			});

			this.bindRoomEvents();
			this.bindDataEvents();
			this.bindAudioEvents(config);

			await this.room.connect(url, tokenToUse);

			// Enable and publish local microphone track
			await this.room.localParticipant.setMicrophoneEnabled(true);

			this.connected = true;
			this.emit("session_connected");
		} catch (err) {
			this.emit("session_error", err);
			this.terminateSession();
			throw err;
		}
	}

	/**
	 * Terminates the session.
	 */
	public terminateSession(): void {
		const wasConnected = this.connected;

		this.connected = false;
		this.isAgentSpeaking = false;

		if (this.captureAudioFrame) {
			globalThis.cancelAnimationFrame(this.captureAudioFrame);
			this.captureAudioFrame = undefined;
		}

		if (this.audioAnalyzer) {
			this.audioAnalyzer.cleanup();
			this.audioAnalyzer = undefined;
		}

		if (this.room) {
			try {
				this.room.disconnect();
			} catch {
				// ignore
			}
			this.room = undefined;
		}

		if (wasConnected) {
			this.emit("session_disconnected");
		}
	}

	/**
	 * Mutes the local microphone.
	 */
	public mute(): void {
		if (this.connected && this.room) {
			this.room.localParticipant.setMicrophoneEnabled(false);
		}
	}

	/**
	 * Unmutes the local microphone.
	 */
	public unmute(): void {
		if (this.connected && this.room) {
			this.room.localParticipant.setMicrophoneEnabled(true);
		}
	}

	private bindRoomEvents() {
		if (!this.room) return;

		this.room.on(RoomEvent.Disconnected, () => {
			if (this.connected) this.terminateSession();
		});

		this.room.on(RoomEvent.Reconnecting, () => {
			this.emit("connection_lost");
		});

		this.room.on(RoomEvent.Reconnected, () => {
			this.emit("connection_restored");
		});

		this.room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
			// if server drops, treat as end
			if (p.identity === "server") {
				this.terminateSession();
			}
		});

		// Listen for LiveKit native transcription events
		this.room.on(
			RoomEvent.TranscriptionReceived,
			(
				segments: TranscriptionSegment[],
				participant?: Participant,
				publication?: TrackPublication
			) => {
				// Convert LiveKit TranscriptionSegment to our format
				const transcript = segments.map((segment) => ({
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

				this.emit("transcript_updated", { transcript });
			}
		);
	}

	private bindAudioEvents(config: SessionConfig) {
		if (!this.room) return;

		this.room.on(
			RoomEvent.TrackSubscribed,
			async (track, publication, participant) => {
				if (track.kind !== Track.Kind.Audio) return;

				// Attach for playback (LiveKit creates audio element)
				track.attach();

				// If raw audio enabled, analyze audio from agent
				if (config.enableRawAudio && track instanceof RemoteAudioTrack) {
					try {
						this.audioAnalyzer = await createAudioAnalyzerFromLiveKitTrack(
							track,
							config.audioSampleRate ?? 24000
						);
						this.captureAudioSamples();
					} catch (err) {
						this.emit("session_error", err);
					}
				}
			}
		);
	}

	private captureAudioSamples() {
		if (!this.connected || !this.audioAnalyzer) return;

		const pcm = this.audioAnalyzer.getPCMFrame();
		this.emit("audio_stream", pcm);

		this.captureAudioFrame = globalThis.requestAnimationFrame(() =>
			this.captureAudioSamples()
		);
	}

	private bindDataEvents() {
		if (!this.room) return;

		this.room.on(
			RoomEvent.DataReceived,
			(payload, participant, kind, topic) => {
				// Try to decode payload
				let event: any;
				try {
					const decoded = new TextDecoder().decode(payload);
					event = JSON.parse(decoded);
				} catch (parseErr) {
					return;
				}

				// Accept data from server participant
				const identity = participant?.identity || "";

				try {
					/**
					 * Expected server events (Retell-style):
					 * - metadata
					 * - update
					 * - agent_start_talking
					 * - agent_stop_talking
					 *
					 * We map these to Verbex contract.
					 */

					// Handle different event type field names
					const eventType =
						event.event_type || event.type || event.eventType || event.event;

					switch (eventType) {
						case "metadata": {
							this.emit("session_metadata", event);
							break;
						}

						case "update": {
							// Validate and normalize transcript payload
							const transcriptPayload: TranscriptUpdatedPayload = {
								transcript:
									event.transcript || event.transcripts || event.messages || [],
							};

							this.emit("transcript_updated", transcriptPayload);
							break;
						}

						case "agent_start_talking": {
							this.isAgentSpeaking = true;
							this.emit("agent_speech_started");
							break;
						}

						case "agent_stop_talking": {
							this.isAgentSpeaking = false;
							this.emit("agent_speech_ended");
							break;
						}

						default:
							// Unknown event type - ignore
							break;
					}
				} catch (err) {}
			}
		);
	}
}

// Re-export types
export * from "./types";
export * from "./audioAnalyzer";
