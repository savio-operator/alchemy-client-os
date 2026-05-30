// Browser-only WebRTC voice/video/screenshare manager

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export interface VoiceParticipant {
  userId: string;
  name: string;
  role: string;
  muted: boolean;
  deafened: boolean;
  joinedAt: string;
}

interface SignalMessage {
  id: string;
  type: string;
  fromUserId: string;
  toUserId: string;
  payload: string;
}

export class VoiceClient {
  private channelId: string;
  private userId: string;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private alive = true;
  private seenSignalIds = new Set<string>();

  // Callbacks
  onRemoteStream: ((userId: string, stream: MediaStream, type: "audio" | "video" | "screen") => void) | null = null;
  onParticipantLeft: ((userId: string) => void) | null = null;
  onParticipantsUpdate: ((participants: VoiceParticipant[]) => void) | null = null;

  constructor(channelId: string, userId: string) {
    this.channelId = channelId;
    this.userId = userId;
  }

  async join(): Promise<MediaStream> {
    // 1. Get microphone audio
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // 2. POST join — server returns current participants
    const res = await fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    });
    const data = await res.json();

    // 3. Start polling for signals
    this.startPolling();

    // 4. Create offers for existing participants
    if (data.participants) {
      for (const p of data.participants as VoiceParticipant[]) {
        if (p.userId !== this.userId) {
          await this.createOffer(p.userId);
        }
      }
    }

    return this.localStream;
  }

  private startPolling() {
    const poll = async () => {
      if (!this.alive) return;
      try {
        const res = await fetch(`/api/team-chat/channels/${this.channelId}/voice?signals=true`);
        const data = await res.json();

        if (data.signals) {
          for (const signal of data.signals as SignalMessage[]) {
            if (!this.seenSignalIds.has(signal.id)) {
              this.seenSignalIds.add(signal.id);
              await this.handleSignal(signal);
            }
          }
        }

        if (data.participants && this.onParticipantsUpdate) {
          this.onParticipantsUpdate(data.participants);
        }
      } catch {
        // Network error — ignore, retry next tick
      }
      if (this.alive) setTimeout(poll, 1000);
    };
    poll();
  }

  private async handleSignal(signal: SignalMessage) {
    const { type, fromUserId, payload } = signal;
    const data = JSON.parse(payload);

    if (type === "offer") {
      const pc = this.getOrCreatePeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(fromUserId, "answer", JSON.stringify(answer));
    } else if (type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (type === "ice-candidate") {
      const pc = this.peers.get(fromUserId);
      if (pc && data) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        } catch {
          // Ignore stale ICE candidates
        }
      }
    }
  }

  private getOrCreatePeer(remoteUserId: string): RTCPeerConnection {
    if (this.peers.has(remoteUserId)) return this.peers.get(remoteUserId)!;

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }
    // Add camera tracks if already on
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => pc.addTrack(track, this.cameraStream!));
    }
    // Add screen tracks if already sharing
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => pc.addTrack(track, this.screenStream!));
    }

    // Send ICE candidates as they arrive
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(remoteUserId, "ice-candidate", JSON.stringify(e.candidate));
      }
    };

    // Handle incoming tracks
    pc.ontrack = (e) => {
      if (this.onRemoteStream && e.streams[0]) {
        const type = e.track.kind === "video" ? "video" : "audio";
        this.onRemoteStream(remoteUserId, e.streams[0], type);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.removePeer(remoteUserId);
      }
    };

    this.peers.set(remoteUserId, pc);
    return pc;
  }

  private async createOffer(remoteUserId: string) {
    const pc = this.getOrCreatePeer(remoteUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal(remoteUserId, "offer", JSON.stringify(offer));
  }

  private async sendSignal(toUserId: string, type: string, payload: string) {
    await fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signal", toUserId, type, payload }),
    });
  }

  async enableCamera(): Promise<MediaStream> {
    this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Add video track to all existing peers and renegotiate
    for (const [userId, pc] of this.peers) {
      this.cameraStream.getVideoTracks().forEach((track) => {
        pc.addTrack(track, this.cameraStream!);
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(userId, "offer", JSON.stringify(offer));
    }
    return this.cameraStream;
  }

  async disableCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
  }

  async shareScreen(): Promise<MediaStream> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // Add screen tracks to all existing peers and renegotiate
    for (const [userId, pc] of this.peers) {
      this.screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.screenStream!);
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(userId, "offer", JSON.stringify(offer));
    }
    // Handle user stopping share via browser native UI
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
    }
    return this.screenStream;
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
  }

  setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", muted }),
    }).catch(() => {});
  }

  setDeafened(deafened: boolean) {
    // Remote audio muting is handled in the UI layer
    fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", deafened }),
    }).catch(() => {});
  }

  private removePeer(userId: string) {
    const pc = this.peers.get(userId);
    if (pc) {
      pc.close();
      this.peers.delete(userId);
    }
    this.onParticipantLeft?.(userId);
  }

  async leave() {
    this.alive = false;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.cameraStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    for (const [, pc] of this.peers) pc.close();
    this.peers.clear();
    await fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    }).catch(() => {});
  }
}
