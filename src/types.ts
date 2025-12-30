export interface SessionConfig {
	/**
	 * JWT token from server-side create-web-session API.
	 * This is the required method for authentication.
	 */
	sessionToken: string;

	/**
	 * Requested sample rate for raw audio analysis (browser may choose otherwise)
	 * default: 24000
	 */
	audioSampleRate?: number;

	/**
	 * Optional input/output device selection
	 */
	inputDeviceId?: string;
	outputDeviceId?: string;

	/**
	 * Enables audio_stream + audioAnalyzer functionality
	 */
	enableRawAudio?: boolean;
}

export type TranscriptRole = "agent" | "user";

export interface TranscriptEntry {
	role: TranscriptRole;
	content: string;
}

export interface TranscriptUpdatedPayload {
	transcript: TranscriptEntry[];
}

/**
 * Session metadata emitted from server.
 * Kept flexible since server may include dynamic keys.
 */
export type SessionMetadataPayload = Record<string, any>;

/**
 * All SDK events and their payload types.
 */
export interface VerbexClientEvents {
	// lifecycle
	session_connected: void;
	session_disconnected: void;
	microphone_permission_denied: { error: Error };

	// speech
	agent_speech_started: void;
	agent_speech_ended: void;

	// realtime data
	transcript_updated: TranscriptUpdatedPayload;
	session_metadata: SessionMetadataPayload;
	audio_stream: Float32Array;

	// connection
	session_error: unknown;
	connection_lost: void;
	connection_restored: void;
}

/**
 * Helper type to extract payload for event key
 */
export type EventPayload<K extends keyof VerbexClientEvents> =
	VerbexClientEvents[K];
