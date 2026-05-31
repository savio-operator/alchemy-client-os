// Browser-only WebRTC voice/video/screenshare manager

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free TURN relays for NAT traversal (metered.ca open TURN)
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "e8dd65b92f6dce4b5ebb4592",
    credential: "uFdKisMhNJFiYbhL",
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "e8dd65b92f6dce4b5ebb4592",
    credential: "uFdKisMhNJFiYbhL",
  },
  {
    urls: "turn:a.relay.metered.ca:443?transport=tcp",
    username: "e8dd65b92f6dce4b5ebb4592",
    credential: "uFdKisMhNJFiYbhL",
  },
];

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
  private negotiating: Set<string> = new Set();
  private knownParticipantIds: Set<string> = new Set();

  // Callbacks
  onRemoteStream: ((userId: string, stream: MediaStream, type: "audio" | "video" | "screen") => void) | null = null;
  onRemoteStreamRemoved: ((userId: string) => void) | null = null;
  onParticipantLeft: ((userId: string) => void) | null = null;
  onParticipantsUpdate: ((participants: VoiceParticipant[]) => void) | null = null;
  onCameraStream: ((stream: MediaStream | null) => void) | null = null;
  onScreenStream: ((stream: MediaStream | null) => void) | null = null;
  onScreenStopped: (() => void) | null = null;

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

    // Track known participants
    if (data.participants) {
      for (const p of data.participants as VoiceParticipant[]) {
        this.knownParticipantIds.add(p.userId);
      }
    }

    // 3. Start polling for signals
    this.startPolling();

    // 4. Create offers for existing participants (stagger to avoid race)
    if (data.participants) {
      for (const p of data.participants as VoiceParticipant[]) {
        if (p.userId !== this.userId) {
          await this.createOffer(p.userId);
          // Small delay between offers to prevent signal congestion
          await new Promise((r) => setTimeout(r, 200));
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

        // Process signals sequentially to maintain order
        if (data.signals) {
          for (const signal of data.signals as SignalMessage[]) {
            if (signal.toUserId === this.userId) {
              await this.handleSignal(signal);
            }
          }
        }

        // Detect new participants and initiate connections
        if (data.participants) {
          const currentIds = new Set((data.participants as VoiceParticipant[]).map((p) => p.userId));

          // New participants — they should send us offers, but if we have a higher ID we initiate
          for (const p of data.participants as VoiceParticipant[]) {
            if (p.userId !== this.userId && !this.knownParticipantIds.has(p.userId)) {
              this.knownParticipantIds.add(p.userId);
              // The joiner (newer participant) sends offers in their join(), so we just need to be ready
            }
          }

          // Detect left participants
          for (const knownId of this.knownParticipantIds) {
            if (!currentIds.has(knownId) && knownId !== this.userId) {
              this.removePeer(knownId);
              this.knownParticipantIds.delete(knownId);
            }
          }

          this.onParticipantsUpdate?.(data.participants);
        }
      } catch {
        // Network error — retry next tick
      }
      if (this.alive) setTimeout(poll, 800);
    };
    // Start first poll quickly
    setTimeout(poll, 300);
  }

  private async handleSignal(signal: SignalMessage) {
    const { type, fromUserId, payload } = signal;
    const data = JSON.parse(payload);

    if (type === "offer") {
      // Close existing peer if any — fresh negotiation
      const existingPc = this.peers.get(fromUserId);
      if (existingPc) {
        existingPc.close();
        this.peers.delete(fromUserId);
      }
      const pc = this.getOrCreatePeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(fromUserId, "answer", JSON.stringify(answer));
    } else if (type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      }
    } else if (type === "ice-candidate") {
      const pc = this.peers.get(fromUserId);
      if (pc && pc.remoteDescription && data) {
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

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
    }
    // Add camera tracks if already on
    if (this.cameraStream) {
      this.cameraStream.getVideoTracks().forEach((track) => pc.addTrack(track, this.cameraStream!));
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
      if (pc.connectionState === "failed") {
        // Retry connection on failure
        this.removePeer(remoteUserId);
        setTimeout(() => {
          if (this.alive && this.knownParticipantIds.has(remoteUserId)) {
            this.createOffer(remoteUserId);
          }
        }, 2000);
      } else if (pc.connectionState === "disconnected") {
        // Wait briefly — might recover
        setTimeout(() => {
          if (pc.connectionState === "disconnected") {
            this.removePeer(remoteUserId);
          }
        }, 5000);
      }
    };

    // Handle renegotiation needed (e.g., when tracks are added)
    pc.onnegotiationneeded = async () => {
      if (this.negotiating.has(remoteUserId)) return;
      this.negotiating.add(remoteUserId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await this.sendSignal(remoteUserId, "offer", JSON.stringify(offer));
      } finally {
        this.negotiating.delete(remoteUserId);
      }
    };

    this.peers.set(remoteUserId, pc);
    return pc;
  }

  private async createOffer(remoteUserId: string) {
    const pc = this.getOrCreatePeer(remoteUserId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(remoteUserId, "offer", JSON.stringify(offer));
    } catch (err) {
      console.error("Failed to create offer for", remoteUserId, err);
    }
  }

  private async sendSignal(toUserId: string, type: string, payload: string) {
    try {
      await fetch(`/api/team-chat/channels/${this.channelId}/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signal", toUserId, type, payload }),
      });
    } catch {
      // Signal send failed — will be retried on next poll cycle
    }
  }

  async enableCamera(): Promise<MediaStream> {
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    // Add video track to all existing peers — onnegotiationneeded will handle renegotiation
    for (const [, pc] of this.peers) {
      this.cameraStream.getVideoTracks().forEach((track) => {
        pc.addTrack(track, this.cameraStream!);
      });
    }
    this.onCameraStream?.(this.cameraStream);
    return this.cameraStream;
  }

  async disableCamera() {
    if (this.cameraStream) {
      const tracks = this.cameraStream.getVideoTracks();
      // Remove tracks from peers
      for (const [, pc] of this.peers) {
        const senders = pc.getSenders();
        for (const track of tracks) {
          const sender = senders.find((s) => s.track === track);
          if (sender) pc.removeTrack(sender);
        }
      }
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
      this.onCameraStream?.(null);
    }
  }

  async shareScreen(): Promise<MediaStream> {
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // Add screen tracks to all existing peers — onnegotiationneeded handles renegotiation
    for (const [, pc] of this.peers) {
      this.screenStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.screenStream!);
      });
    }
    // Handle user stopping share via browser native UI
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
        this.onScreenStopped?.();
      };
    }
    this.onScreenStream?.(this.screenStream);
    return this.screenStream;
  }

  async stopScreenShare() {
    if (this.screenStream) {
      const tracks = this.screenStream.getTracks();
      // Remove tracks from peers
      for (const [, pc] of this.peers) {
        const senders = pc.getSenders();
        for (const track of tracks) {
          const sender = senders.find((s) => s.track === track);
          if (sender) pc.removeTrack(sender);
        }
      }
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
      this.onScreenStream?.(null);
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
