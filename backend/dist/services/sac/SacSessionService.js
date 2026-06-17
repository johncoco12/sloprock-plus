import dgram from "node:dgram";
import { createHash } from "node:crypto";
import { SAC_CONTROL_PORT, } from "./types.js";
const HEARTBEAT_TIMEOUT_MS = 30_000;
const EXPIRE_INTERVAL_MS = 5_000;
function hashPin(pin, salt) {
    return createHash("sha256").update(salt + pin).digest("hex");
}
function send(socket, ip, port, payload) {
    const buf = Buffer.from(JSON.stringify(payload));
    socket.send(buf, port, ip, (err) => {
        if (err)
            console.error("[SacSession] send error:", err.message);
    });
}
// Manages authenticated SAC sessions over UDP (port 54921).
// Acts as the bridge between the UDP world (SAC app) and the WebSocket
// world (frontend client).
export class SacSessionService {
    profileRepo;
    socket = null;
    expireInterval = null;
    sessions = new Map();
    constructor(profileRepo) {
        this.profileRepo = profileRepo;
    }
    start() {
        this.socket = dgram.createSocket("udp4");
        this.socket.on("error", (err) => {
            console.error("[SacSession] socket error:", err.message);
        });
        this.socket.on("message", (msg, rinfo) => {
            void this.handleMessage(msg, rinfo);
        });
        this.socket.bind(SAC_CONTROL_PORT, () => {
            console.info(`[SacSession] listening on UDP :${SAC_CONTROL_PORT}`);
        });
        this.expireInterval = setInterval(() => this.expireStale(), EXPIRE_INTERVAL_MS);
    }
    stop() {
        if (this.expireInterval) {
            clearInterval(this.expireInterval);
            this.expireInterval = null;
        }
        for (const session of this.sessions.values())
            this.sendToSac(session, { type: "DISCONNECT", reason: "server stopping" });
        this.sessions.clear();
        this.socket?.close();
        this.socket = null;
    }
    getSessions() {
        return Array.from(this.sessions.values()).map(s => ({
            sessionId: s.sessionId,
            profileId: s.profileId,
            profileName: s.profileName,
            sacIp: s.sacIp,
            lastSeen: s.lastSeen,
            linked: s.linkedWs !== null,
        }));
    }
    getSessionsForProfile(profileId) {
        return this.getSessions().filter(s => s.profileId === profileId);
    }
    /**
     * Returns true if `ip` matches the SAC instance that owns `sessionId`.
     * Used by PitchProcessorService to reject spoofed pitch datagrams.
     */
    validatePitchSource(sessionId, ip) {
        const session = this.sessions.get(sessionId);
        return session !== undefined && session.sacIp === ip;
    }
    linkWs(sessionId, callerProfileId, ws) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return "not_found";
        if (session.profileId !== callerProfileId)
            return "forbidden";
        if (session.linkedWs !== null &&
            session.linkedWs.readyState < WebSocket.CLOSING) {
            return "already_linked";
        }
        session.linkedWs = ws;
        const event = {
            type: "sac:connected",
            sessionId,
            profileId: session.profileId,
            profileName: session.profileName,
        };
        ws.send(JSON.stringify(event));
        return "ok";
    }
    unlinkWs(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session)
            session.linkedWs = null;
    }
    sendStartMonitoring(sessionId, trackId, tuning, arrangement) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "START_MONITORING", trackId, tuning, arrangement });
        session.activeTrackId = trackId;
    }
    sendStopMonitoring(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "STOP_MONITORING" });
        session.activeTrackId = null;
    }
    sendSetParameter(sessionId, pluginIndex, parameterIndex, value) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "SET_PARAMETER", pluginIndex, parameterIndex, value });
    }
    sendSetBypass(sessionId, pluginIndex, bypassed) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "SET_BYPASS", pluginIndex, bypassed });
    }
    sendMovePlugin(sessionId, fromIndex, toIndex) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "MOVE_PLUGIN", fromIndex, toIndex });
    }
    sendRemovePlugin(sessionId, pluginIndex) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "REMOVE_PLUGIN", pluginIndex });
    }
    sendAddPlugin(sessionId, pluginId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "ADD_PLUGIN", pluginId });
    }
    requestChainState(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sendToSac(session, { type: "REQUEST_CHAIN_STATE" });
    }
    forwardPitch(sessionId, pitchPayload) {
        this.sessions.get(sessionId)?.linkedWs?.send(JSON.stringify(pitchPayload));
    }
    async handleMessage(msg, rinfo) {
        let data;
        try {
            data = JSON.parse(msg.toString());
        }
        catch {
            return;
        }
        switch (data.type) {
            case "CONNECT_REQUEST": return this.handleConnect(data, rinfo);
            case "HEARTBEAT": return this.handleHeartbeat(data, rinfo);
            case "MONITORING_STARTED":
                return this.handleMonitoringStarted(data);
            case "MONITORING_STOPPED":
                return this.handleMonitoringStopped(data);
            case "CHAIN_STATE":
                return this.handleChainState(data);
            case "PLUGIN_LIST":
                return this.handlePluginList(data);
        }
    }
    async handleConnect(data, rinfo) {
        const sacPort = data.sacPort ?? rinfo.port;
        const deny = (reason) => this.socket && send(this.socket, rinfo.address, sacPort, {
            type: "CONNECT_ACK", sessionId: data.sessionId, status: "denied", reason,
        });
        if (!data.sessionId || !data.profileId || data.authToken === undefined)
            return void deny("missing fields");
        const profile = await this.profileRepo.findById(Number(data.profileId));
        if (!profile)
            return void deny("profile not found");
        // authToken is the raw PIN; verify against stored hash
        const expected = hashPin(data.authToken, profile.pinSalt);
        if (expected !== profile.pinCode)
            return void deny("invalid pin");
        const session = {
            sessionId: data.sessionId,
            profileId: profile.id,
            profileName: profile.name,
            sacIp: rinfo.address,
            sacPort,
            lastSeen: Date.now(),
            linkedWs: null,
            activeTrackId: null,
        };
        this.sessions.set(data.sessionId, session);
        this.socket && send(this.socket, rinfo.address, sacPort, {
            type: "CONNECT_ACK", sessionId: data.sessionId, status: "ok",
        });
        console.info(`[SacSession] ${profile.name} connected from ${rinfo.address}:${sacPort}`);
    }
    handleHeartbeat(data, rinfo) {
        const session = this.sessions.get(data.sessionId);
        if (!session)
            return;
        // Reject heartbeats from addresses that don't match the authenticated SAC endpoint
        if (rinfo.address !== session.sacIp)
            return;
        session.lastSeen = Date.now();
        this.socket && send(this.socket, rinfo.address, session.sacPort, {
            type: "HEARTBEAT_ACK", ts: Date.now(),
        });
    }
    handleMonitoringStarted(data) {
        const session = this.sessions.get(data.sessionId);
        if (!session || !session.linkedWs)
            return;
        const event = {
            type: "sac:monitoring_active",
            trackId: session.activeTrackId ?? "",
        };
        session.linkedWs.send(JSON.stringify(event));
    }
    handleMonitoringStopped(data) {
        const session = this.sessions.get(data.sessionId);
        if (!session || !session.linkedWs)
            return;
        session.activeTrackId = null;
        session.linkedWs.send(JSON.stringify({ type: "sac:monitoring_stopped" }));
    }
    handleChainState(data) {
        const session = this.sessions.get(data.sessionId);
        if (!session || !session.linkedWs)
            return;
        const event = { type: "sac:chain_state", plugins: data.plugins };
        session.linkedWs.send(JSON.stringify(event));
    }
    handlePluginList(data) {
        const session = this.sessions.get(data.sessionId);
        if (!session || !session.linkedWs)
            return;
        const event = { type: "sac:plugin_list", plugins: data.plugins };
        session.linkedWs.send(JSON.stringify(event));
    }
    expireStale() {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.lastSeen > HEARTBEAT_TIMEOUT_MS) {
                console.info(`[SacSession] session ${id} timed out`);
                const event = { type: "sac:disconnected", sessionId: id };
                session.linkedWs?.send(JSON.stringify(event));
                this.sessions.delete(id);
            }
        }
    }
    sendToSac(session, payload) {
        if (this.socket)
            send(this.socket, session.sacIp, session.sacPort, payload);
    }
}
//# sourceMappingURL=SacSessionService.js.map