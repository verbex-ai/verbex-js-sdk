import { RemoteAudioTrack } from "livekit-client";

/**
 * AudioAnalyzer wraps the Web Audio API's AnalyserNode to provide real-time
 * audio analysis capabilities for voice AI applications.
 *
 * This class enables:
 * - Raw PCM audio frame extraction
 * - Volume level calculation
 * - Audio visualization data
 *
 * @example
 * ```typescript
 * const analyzer = new AudioAnalyzer(mediaStream, 24000);
 * const pcmData = analyzer.getPCMFrame();
 * const volume = analyzer.calculateVolume();
 * ```
 */
export class AudioAnalyzer {
	/** Web Audio API context for audio processing */
	public readonly audioContext: AudioContext;

	/** Source node connected to the media stream */
	public readonly sourceNode: MediaStreamAudioSourceNode;

	/** Analyser node that provides audio analysis data */
	public readonly analyser: AnalyserNode;

	/** Gain node for potential volume control (currently pass-through) */
	public readonly gainNode: GainNode;

	/** Flag to prevent double cleanup */
	private closed = false;

	/**
	 * Creates a new AudioAnalyzer instance.
	 *
	 * @param mediaStream - The MediaStream to analyze (typically from LiveKit audio track)
	 * @param sampleRate - Target sample rate for the audio context (default: 24000 Hz)
	 *
	 * @example
	 * ```typescript
	 * const stream = new MediaStream([audioTrack]);
	 * const analyzer = new AudioAnalyzer(stream, 24000);
	 * ```
	 */
	constructor(mediaStream: MediaStream, sampleRate = 24000) {
		// Create audio context with the specified sample rate
		// Note: Browser may use a different sample rate based on hardware capabilities
		this.audioContext = new AudioContext({ sampleRate });

		// Create source node from the media stream
		this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

		// Create analyser node for audio analysis
		this.analyser = this.audioContext.createAnalyser();

		// Create gain node (currently used as pass-through, but available for future volume control)
		this.gainNode = this.audioContext.createGain();

		// Configure analyser for time-domain PCM data extraction
		// fftSize must be a power of 2 between 32 and 32768
		// 2048 provides good balance between resolution and performance
		this.analyser.fftSize = 2048;

		// Set smoothing to 0 for real-time data without averaging
		// Higher values (0-1) would smooth the output but add latency
		this.analyser.smoothingTimeConstant = 0;

		// Connect audio nodes: source -> gain -> analyser
		// This allows us to analyze the audio without affecting playback
		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.analyser);
		// Note: We don't connect to destination (speakers) as playback is handled by LiveKit
	}

	/**
	 * Returns the latest PCM (Pulse Code Modulation) audio frame.
	 * This provides raw audio samples in the time domain.
	 *
	 * The returned Float32Array contains audio samples with values between -1 and 1,
	 * where 0 represents silence.
	 *
	 * @returns Float32Array containing audio samples (length = analyser.fftSize)
	 *
	 * @example
	 * ```typescript
	 * const pcmData = analyzer.getPCMFrame();
	 * console.log(`Frame has ${pcmData.length} samples`); // 2048 samples
	 * // Use pcmData for visualization, e.g., drawing waveforms
	 * ```
	 */
	public getPCMFrame(): Float32Array {
		// Buffer length equals fftSize (2048 in our case)
		const bufferLength = this.analyser.fftSize;

		// Create a Float32Array to hold the audio samples
		const frame = new Float32Array(bufferLength);

		// Fill the array with time-domain data (actual waveform)
		// Values range from -1.0 to 1.0
		this.analyser.getFloatTimeDomainData(frame);

		return frame;
	}

	/**
	 * Calculates the current volume level from PCM audio data using RMS.
	 * RMS (Root Mean Square) provides a perceptually accurate measure of loudness.
	 *
	 * This is useful for:
	 * - Audio visualization (volume meters, waveforms)
	 * - Voice activity detection
	 * - Dynamic UI feedback
	 *
	 * @returns A number between 0 and 1 representing the current volume level.
	 *          - 0 = silence
	 *          - 1 = maximum volume
	 *
	 * @example
	 * ```typescript
	 * function updateVolumeMeter() {
	 *   const volume = analyzer.calculateVolume();
	 *   volumeMeterElement.style.width = `${volume * 100}%`;
	 *   requestAnimationFrame(updateVolumeMeter);
	 * }
	 * ```
	 */
	public calculateVolume(): number {
		// Get the latest audio frame
		const pcm = this.getPCMFrame();

		// Handle edge case of empty data
		if (pcm.length === 0) return 0;

		// Calculate RMS (Root Mean Square)
		// RMS = sqrt(average of squared values)
		let sumSquares = 0;
		for (const sample of pcm) {
			// Square each sample to get power
			sumSquares += sample * sample;
		}

		// Calculate RMS: square root of the mean of squares
		const rms = Math.sqrt(sumSquares / pcm.length);

		// Normalize to 0-1 range and clamp to ensure bounds
		// PCM values are in range [-1, 1], so RMS will be in [0, 1]
		return Math.min(1, Math.max(0, rms));
	}

	/**
	 * Cleans up all audio resources and closes the audio context.
	 * This should be called when the analyzer is no longer needed to free up resources.
	 *
	 * Note: Once cleanup is called, the analyzer cannot be reused.
	 *
	 * @returns Promise that resolves when cleanup is complete
	 *
	 * @example
	 * ```typescript
	 * // When session ends
	 * await analyzer.cleanup();
	 * ```
	 */
	public async cleanup(): Promise<void> {
		// Prevent double cleanup
		if (this.closed) return;
		this.closed = true;

		// Disconnect all audio nodes to stop processing
		try {
			this.sourceNode.disconnect();
			this.gainNode.disconnect();
			this.analyser.disconnect();
		} catch {
			// Ignore errors during disconnect (nodes may already be disconnected)
		}

		// Close the audio context to release system resources
		try {
			await this.audioContext.close();
		} catch {
			// Ignore errors during close (context may already be closed)
		}
	}
}

/**
 * Utility function to create an AudioAnalyzer from a LiveKit RemoteAudioTrack.
 *
 * This helper extracts the underlying MediaStreamTrack from LiveKit's audio track
 * and creates an AudioAnalyzer instance for it.
 *
 * @param track - The LiveKit RemoteAudioTrack to analyze (agent's audio output)
 * @param sampleRate - Target sample rate for the audio context (default: 24000 Hz)
 * @returns Promise that resolves to an AudioAnalyzer instance
 *
 * @example
 * ```typescript
 * // In your LiveKit track subscription handler
 * room.on(RoomEvent.TrackSubscribed, async (track) => {
 *   if (track instanceof RemoteAudioTrack) {
 *     const analyzer = await createAudioAnalyzerFromLiveKitTrack(track, 24000);
 *     // Now you can use analyzer.getPCMFrame() or analyzer.calculateVolume()
 *   }
 * });
 * ```
 */
export async function createAudioAnalyzerFromLiveKitTrack(
	track: RemoteAudioTrack,
	sampleRate = 24000
): Promise<AudioAnalyzer> {
	// Extract the native MediaStreamTrack from LiveKit's wrapper
	const mediaStreamTrack = track.mediaStreamTrack;

	// Create a MediaStream from the track (required by Web Audio API)
	const mediaStream = new MediaStream([mediaStreamTrack]);

	// Create and return the AudioAnalyzer
	return new AudioAnalyzer(mediaStream, sampleRate);
}
