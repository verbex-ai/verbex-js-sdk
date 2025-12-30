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
export declare class AudioAnalyzer {
    /** Web Audio API context for audio processing */
    readonly audioContext: AudioContext;
    /** Source node connected to the media stream */
    readonly sourceNode: MediaStreamAudioSourceNode;
    /** Analyser node that provides audio analysis data */
    readonly analyser: AnalyserNode;
    /** Gain node for potential volume control (currently pass-through) */
    readonly gainNode: GainNode;
    /** Flag to prevent double cleanup */
    private closed;
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
    constructor(mediaStream: MediaStream, sampleRate?: number);
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
    getPCMFrame(): Float32Array;
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
    calculateVolume(): number;
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
    cleanup(): Promise<void>;
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
export declare function createAudioAnalyzerFromLiveKitTrack(track: RemoteAudioTrack, sampleRate?: number): Promise<AudioAnalyzer>;
//# sourceMappingURL=audioAnalyzer.d.ts.map