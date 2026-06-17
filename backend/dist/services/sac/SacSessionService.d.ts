import type { WebSocket } from "@fastify/websocket";
import type { IProfileRepository } from "../../domain/repositories.js";
export declare class SacSessionService {
    private readonly profileRepo;
    private socket;
    private expireInterval;
    private readonly sessions;
    constructor(profileRepo: IProfileRepository);
    start(): void;
    stop(): void;
    getSessions(): Array<{
        sessionId: string;
        profileId: number;
        profileName: string;
        sacIp: string;
        lastSeen: number;
        linked: boolean;
    }>;
    getSessionsForProfile(profileId: number): {
        sessionId: string;
        profileId: number;
        profileName: string;
        sacIp: string;
        lastSeen: number;
        linked: boolean;
    }[];
    /**
     * Returns true if `ip` matches the SAC instance that owns `sessionId`.
     * Used by PitchProcessorService to reject spoofed pitch datagrams.
     */
    validatePitchSource(sessionId: string, ip: string): boolean;
    linkWs(sessionId: string, callerProfileId: number, ws: WebSocket): "ok" | "not_found" | "forbidden" | "already_linked";
    unlinkWs(sessionId: string): void;
    sendStartMonitoring(sessionId: string, trackId: string, tuning: string, arrangement: string): void;
    sendStopMonitoring(sessionId: string): void;
    sendSetParameter(sessionId: string, pluginIndex: number, parameterIndex: number, value: number): void;
    sendSetBypass(sessionId: string, pluginIndex: number, bypassed: boolean): void;
    sendMovePlugin(sessionId: string, fromIndex: number, toIndex: number): void;
    sendRemovePlugin(sessionId: string, pluginIndex: number): void;
    sendAddPlugin(sessionId: string, pluginId: string): void;
    requestChainState(sessionId: string): void;
    forwardPitch(sessionId: string, pitchPayload: object): void;
    private handleMessage;
    private handleConnect;
    private handleHeartbeat;
    private handleMonitoringStarted;
    private handleMonitoringStopped;
    private handleChainState;
    private handlePluginList;
    private expireStale;
    private sendToSac;
}
//# sourceMappingURL=SacSessionService.d.ts.map