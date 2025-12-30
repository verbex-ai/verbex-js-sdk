import { RemoteAudioTrack } from "livekit-client";
/**
 * AudioAnalyzer wraps a WebAudio AnalyserNode and provides PCM frame access.
 */
export declare class AudioAnalyzer {
    readonly audioContext: AudioContext;
    readonly sourceNode: MediaStreamAudioSourceNode;
    readonly analyser: AnalyserNode;
    readonly gainNode: GainNode;
    private closed;
    constructor(mediaStream: MediaStream, sampleRate?: number);
    /**
     * Returns latest PCM frame (Float32Array)
     */
    getPCMFrame(): Float32Array;
    /**
     * Calculates the current volume level from PCM audio data.
     * Uses RMS (Root Mean Square) calculation to determine audio volume.
     *
     * @returns A number between 0 and 1 representing the current volume level.
     *          0 indicates silence, 1 indicates maximum volume.
     */
    calculateVolume(): number;
    cleanup(): Promise<void>;
}
/**
 * Utility: Create AudioAnalyzer from LiveKit RemoteAudioTrack
 */
export declare function createAudioAnalyzerFromLiveKitTrack(track: RemoteAudioTrack, sampleRate?: number): Promise<AudioAnalyzer>;
//# sourceMappingURL=audioAnalyzer.d.ts.map