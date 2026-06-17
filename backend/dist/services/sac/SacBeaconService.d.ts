export declare class SacBeaconService {
    private readonly serverName;
    private readonly httpPort;
    private readonly controlPort;
    private readonly pitchPort;
    private readonly serverIpOverride?;
    private socket;
    private interval;
    private readonly serverId;
    constructor(serverName: string, httpPort: number, controlPort?: number, pitchPort?: number, serverIpOverride?: string | undefined);
    start(): void;
    stop(): void;
    private resolvedIp;
    private broadcast;
}
//# sourceMappingURL=SacBeaconService.d.ts.map