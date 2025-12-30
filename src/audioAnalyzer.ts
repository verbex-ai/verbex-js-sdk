import { RemoteAudioTrack } from "livekit-client";

/**
 * AudioAnalyzer wraps a WebAudio AnalyserNode and provides PCM frame access.
 */
export class AudioAnalyzer {
	public readonly audioContext: AudioContext;
	public readonly sourceNode: MediaStreamAudioSourceNode;
	public readonly analyser: AnalyserNode;
	public readonly gainNode: GainNode;

	private closed = false;

	constructor(mediaStream: MediaStream, sampleRate = 24000) {
		this.audioContext = new AudioContext({ sampleRate });

		this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);
		this.analyser = this.audioContext.createAnalyser();
		this.gainNode = this.audioContext.createGain();

		// Configure analyzer for time-domain PCM
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = 0.0;

		// source -> gain -> analyser
		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.analyser);
	}

	/**
	 * Returns latest PCM frame (Float32Array)
	 */
	public getPCMFrame(): Float32Array {
		const bufferLength = this.analyser.fftSize;
		const frame = new Float32Array(bufferLength);
		this.analyser.getFloatTimeDomainData(frame);
		return frame;
	}

	/**
	 * Calculates the current volume level from PCM audio data.
	 * Uses RMS (Root Mean Square) calculation to determine audio volume.
	 * 
	 * @returns A number between 0 and 1 representing the current volume level.
	 *          0 indicates silence, 1 indicates maximum volume.
	 */
	public calculateVolume(): number {
		const pcm = this.getPCMFrame();
		if (pcm.length === 0) return 0;

		// Calculate RMS (Root Mean Square)
		let sumSquares = 0;
		for (let i = 0; i < pcm.length; i++) {
			sumSquares += pcm[i] * pcm[i];
		}
		const rms = Math.sqrt(sumSquares / pcm.length);

		// Normalize to 0-1 range (PCM values are typically -1 to 1)
		// Clamp to ensure we stay within bounds
		return Math.min(1, Math.max(0, rms));
	}

	public async cleanup(): Promise<void> {
		if (this.closed) return;
		this.closed = true;

		try {
			this.sourceNode.disconnect();
			this.gainNode.disconnect();
			this.analyser.disconnect();
		} catch {
			// ignore
		}

		try {
			await this.audioContext.close();
		} catch {
			// ignore
		}
	}
}

/**
 * Utility: Create AudioAnalyzer from LiveKit RemoteAudioTrack
 */
export async function createAudioAnalyzerFromLiveKitTrack(
	track: RemoteAudioTrack,
	sampleRate = 24000
): Promise<AudioAnalyzer> {
	const mediaStreamTrack = track.mediaStreamTrack;
	const mediaStream = new MediaStream([mediaStreamTrack]);
	return new AudioAnalyzer(mediaStream, sampleRate);
}
