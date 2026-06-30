export interface Participant {
  id: string;
  name: string;
  role: "admin" | "listener";
  joinedAt: number;
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface AudioState {
  url: string;
  name: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
}

export interface Room {
  id: string;
  participants: Record<string, Participant>;
  audioState: AudioState;
  chatMessages: ChatMessage[];
  adminId: string | null;
}

export interface DefaultTrack {
  name: string;
  url: string;
}
