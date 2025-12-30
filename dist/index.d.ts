import EventEmitter from "eventemitter3";
import { AudioAnalyzer } from "./audioAnalyzer";
import { SessionConfig, VerbexClientEvents } from "./types";
/**
 * Strongly typed EventEmitter wrapper
 */
declare class TypedEventEmitter extends EventEmitter {
    on<K extends keyof VerbexClientEvents>(event: K, fn: (payload: VerbexClientEvents[K]) => void): this;
    on(event: string | symbol, fn: (...args: any[]) => void, context?: any): this;
    emit<K extends keyof VerbexClientEvents>(event: K, payload?: VerbexClientEvents[K]): boolean;
    emit(event: string | symbol, ...args: any[]): boolean;
}
export declare class VerbexWebClient extends TypedEventEmitter {
    isAgentSpeaking: boolean;
    audioAnalyzer?: AudioAnalyzer;
    private room?;
    private connected;
    private captureAudioFrame?;
    /**
     * Initiates the session using LiveKit.
     *
     * @param config - Session configuration including sessionToken (JWT from server-side API)
     * @throws {Error} If sessionToken is not provided
     */
    initiateSession(config: SessionConfig): Promise<void>;
    /**
     * Terminates the session.
     */
    terminateSession(): void;
    /**
     * Mutes the local microphone.
     */
    mute(): void;
    /**
     * Unmutes the local microphone.
     */
    unmute(): void;
    private bindRoomEvents;
    private bindAudioEvents;
    private captureAudioSamples;
    private bindDataEvents;
}
export * from "./types";
export * from "./audioAnalyzer";
//# sourceMappingURL=index.d.ts.map