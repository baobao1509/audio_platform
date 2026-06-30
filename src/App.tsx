import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Copy,
  Check,
  LogOut,
  Radio,
  Share2,
  Users,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  MessageSquare,
  X,
} from "lucide-react";

import { Room, DefaultTrack, Participant } from "./types";
import LandingPage from "./components/LandingPage";
import ParticipantCard from "./components/ParticipantCard";
import AudioPlayerDeck from "./components/AudioPlayerDeck";
import ChatPanel from "./components/ChatPanel";

// Generate or retrieve stable User ID across page refreshes
const getOrCreateUserId = () => {
  let id = localStorage.getItem("sync_audio_user_id");
  if (!id) {
    id = "usr_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("sync_audio_user_id", id);
  }
  return id;
};

// Default static fallback tracks in case server fetch fails
const FALLBACK_TRACKS: DefaultTrack[] = [
  {
    name: "Lofi Chill Sunset (Relaxing Beat)",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    name: "Deep Focus Ambient Synth",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    name: "Cozy Morning Coffee Jazz",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
];

export default function App() {
  const [userId] = useState(getOrCreateUserId);
  const [name, setName] = useState(() => localStorage.getItem("sync_audio_user_name") || "");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState<"admin" | "listener">("listener");
  const [roomState, setRoomState] = useState<Room | null>(null);
  const [defaultTracks, setDefaultTracks] = useState<DefaultTrack[]>(FALLBACK_TRACKS);
  
  // UI States
  const [error, setError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isChatOpenMobile, setIsChatOpenMobile] = useState(false);

  // Fetch preset tracks from the server on mount
  useEffect(() => {
    fetch("/api/tracks/default")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setDefaultTracks(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch server tracks, using stable backup presets.", err);
      });
  }, []);

  // Parse Room ID from URL hash if present (e.g. website.com/#A8B2C4) for easy share joining
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#") && hash.length === 7) {
        const hashRoomId = hash.substring(1).toUpperCase();
        console.log(`[Hash Route] Detected Room ID in shared URL: ${hashRoomId}`);
        setRoomId(hashRoomId);
      }
    };

    handleHashChange(); // Check on mount
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Sync Room polling interval
  useEffect(() => {
    if (!roomId || !name) return;

    let isSubscribed = true;

    const syncRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            name,
            role,
          }),
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Phòng không tồn tại hoặc đã bị đóng.");
          }
          throw new Error("Lỗi kết nối máy chủ phòng.");
        }

        const data = await response.json();
        
        if (isSubscribed) {
          setRoomState(data.room);
          setRole(data.assignedRole); // Server may adjust role based on room admin availability
          setError("");
        }
      } catch (err: any) {
        console.error("Polling sync error:", err);
        if (isSubscribed) {
          setError(err.message || "Không thể đồng bộ với phòng.");
          // If room doesn't exist anymore, kick user back to landing
          if (err.message && err.message.includes("không tồn tại")) {
            setTimeout(() => {
              handleLeaveRoom();
            }, 3000);
          }
        }
      }
    };

    // Run first immediately
    syncRoom();

    // Start 750ms interval loop for rapid state syncing
    const interval = setInterval(syncRoom, 750);

    const handleUnload = () => {
      if (roomId && userId) {
        fetch(`/api/rooms/${roomId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [roomId, name, role, userId]);

  // Handle Create Room
  const handleCreateRoom = async (userName: string, adminUsername?: string, adminPassword?: string) => {
    try {
      setError("");
      setName(userName);
      localStorage.setItem("sync_audio_user_name", userName);

      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-username": adminUsername || "",
          "x-admin-password": adminPassword || ""
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Tạo phòng thất bại.");
      }
      const data = await response.json();

      if (adminUsername && adminPassword) {
        localStorage.setItem("sync_audio_admin_username", adminUsername);
        localStorage.setItem("sync_audio_admin_password", adminPassword);
      }

      setRole("admin");
      setRoomId(data.roomId);
      window.location.hash = data.roomId;
    } catch (err: any) {
      setError(err.message || "Không thể tạo phòng.");
    }
  };

  // Handle Join Room
  const handleJoinRoom = async (targetRoomId: string, userName: string, selectedRole: "admin" | "listener") => {
    try {
      setError("");
      setName(userName);
      localStorage.setItem("sync_audio_user_name", userName);

      // Verify room exists first
      const verifyRes = await fetch(`/api/rooms/${targetRoomId}`);
      if (!verifyRes.ok) {
        if (verifyRes.status === 404) {
          throw new Error("Mã phòng không tồn tại. Vui lòng kiểm tra lại.");
        }
        throw new Error("Lỗi liên kết máy chủ.");
      }

      setRoomId(targetRoomId);
      setRole(selectedRole);
      window.location.hash = targetRoomId;
    } catch (err: any) {
      setError(err.message || "Không thể tham gia phòng.");
    }
  };

  // Handle Leaving Room
  const handleLeaveRoom = () => {
    if (roomId && userId) {
      fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch((err) => console.error("Failed to notify leave:", err));
    }
    setRoomId("");
    setRoomState(null);
    window.location.hash = "";
    setError("");
  };

  // Broadcast Audio sync updates (called by player deck)
  const handleSyncState = useCallback(
    async (isPlaying: boolean, currentTime: number, url?: string, name?: string) => {
      if (!roomId) return;

      // Optimistically update the local roomState so the UI changes instantly for the Admin
      setRoomState((prev) => {
        if (!prev) return prev;
        const currentAudioState = prev.audioState || {
          url: "",
          name: "",
          isPlaying: false,
          currentTime: 0,
          lastUpdated: Date.now()
        };
        return {
          ...prev,
          audioState: {
            ...currentAudioState,
            isPlaying,
            currentTime,
            url: url !== undefined ? url : currentAudioState.url,
            name: name !== undefined ? name : currentAudioState.name,
            lastUpdated: Date.now(),
          },
        };
      });

      try {
        const response = await fetch(`/api/rooms/${roomId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            isPlaying,
            currentTime,
            url,
            name,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Keep state synced with the exact state returned by the server
          setRoomState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              audioState: data.audioState,
            };
          });
        }
      } catch (err) {
        console.error("Failed to broadcast sync event:", err);
      }
    },
    [roomId, userId]
  );

  // Broadcast Chat messages
  const handleSendMessage = async (text: string) => {
    if (!roomId) return;
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name,
          text,
        }),
      });

      if (response.ok && roomState) {
        const newMsg = await response.json();
        // Optimistic local state update for snappy chat response
        setRoomState({
          ...roomState,
          chatMessages: [...roomState.chatMessages, newMsg],
        });
      }
    } catch (err) {
      console.error("Failed to post chat message:", err);
    }
  };

  // Copy Room ID Utility
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  // Copy Shareable Invitation Link Utility
  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/#${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setIsCopiedLink(true);
    setTimeout(() => setIsCopiedLink(false), 1500);
  };

  // If not inside a room, show the Landing lobby
  if (!roomId || !roomState) {
    return <LandingPage onJoinRoom={handleJoinRoom} onCreateRoom={handleCreateRoom} error={error} />;
  }

  const activeParticipants = Object.values(roomState.participants) as Participant[];
  const isAudioPlaying = roomState.audioState?.isPlaying || false;

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Immersive Background Radial Gradients & Glow overlays */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_#1a1a2e_0%,_#050508_100%)] pointer-events-none z-0" />
      <div className="glow glow-indigo top-[-200px] left-[-150px] w-[600px] h-[600px] z-0" />
      <div className="glow glow-pink bottom-[-200px] right-[-150px] w-[600px] h-[600px] z-0" />

      {/* HEADER BAR */}
      <header className="bg-black/30 backdrop-blur-xl border-b border-white/5 px-6 py-4.5 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shadow-lg relative">
        {/* Logo and Status */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-950/50 border border-white/10">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-md font-semibold text-white flex items-center gap-2">
              <span>SyncAudio Room</span>
              <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Đồng bộ trực tuyến
              </span>
            </h1>
            <p className="text-[11px] text-white/40">Môi trường nghe nhạc chung thời gian thực</p>
          </div>
        </div>

        {/* Room ID Sharing Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Room ID badge */}
          <div className="flex items-center bg-white/3 border border-white/8 rounded-xl pl-3.5 pr-1.5 py-1.5 text-xs">
            <span className="text-white/40 font-mono font-medium mr-1.5">Phòng:</span>
            <span className="text-white font-bold font-mono tracking-widest uppercase mr-3">{roomId}</span>
            <button
              onClick={copyRoomId}
              className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
              title="Sao chép Mã phòng"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Invitation Link Button */}
          <button
            onClick={copyInviteLink}
            className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-200 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            {isCopiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Đã chép link!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Mời bạn bè</span>
              </>
            )}
          </button>

          {/* Exit Room Button */}
          <button
            onClick={handleLeaveRoom}
            className="px-3.5 py-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/20 text-red-300 hover:text-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </header>

      {/* MAIN SCREEN GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0 relative z-10">
        
        {/* LEFT / CENTER COLUMN: Video Meet grid + Audio synchronizer */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-0 lg:pr-1 min-h-0">
          
          {/* Active Error Notice */}
          {error && (
            <div className="bg-red-950/20 border border-red-900/20 rounded-2xl p-4 flex items-start gap-3 text-red-200 text-xs">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-semibold">Sự cố đồng bộ hóa</p>
                <p className="text-red-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* PART 1: Google Meet Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-white/40">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-white/40" />
                <span>Thành viên trực tuyến ({activeParticipants.length})</span>
              </div>
              <span>Meet Grid View</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {activeParticipants.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  >
                    <ParticipantCard
                      participant={p}
                      isCurrentUser={p.id === userId}
                      isAudioPlaying={isAudioPlaying}
                      isAdmin={p.role === "admin"}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* PART 2: Sync Audio Player Deck */}
          <AudioPlayerDeck
            room={roomState}
            userId={userId}
            roomId={roomId}
            onSyncState={handleSyncState}
            defaultTracks={defaultTracks}
          />
        </div>

        {/* RIGHT COLUMN: Chat Room & Members Panel */}
        <div className="hidden lg:block lg:col-span-1 h-full min-h-[600px]">
          <ChatPanel room={roomState} userId={userId} onSendMessage={handleSendMessage} />
        </div>
      </main>

      {/* Mobile Chat Toggle Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsChatOpenMobile(!isChatOpenMobile)}
          className="flex items-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl shadow-indigo-950 border border-white/10 active:scale-95 transition-all"
        >
          {isChatOpenMobile ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          <span className="text-xs font-semibold">
            {isChatOpenMobile ? "Đóng chat" : "Trò chuyện"}
          </span>
          {roomState.chatMessages.length > 0 && !isChatOpenMobile && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
            </span>
          )}
        </button>
      </div>

      {/* Mobile Chat Bottom Sheet Drawer */}
      <AnimatePresence>
        {isChatOpenMobile && (
          <>
            {/* Backdrop layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpenMobile(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Bottom Sheet wrapper */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 h-[75vh] bg-[#09090f] border-t border-white/10 rounded-t-3xl z-50 flex flex-col overflow-hidden shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.8)]"
            >
              {/* Top drag handler/header bar */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/5 bg-black/40">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Trò chuyện & Thành viên</span>
                </div>
                <button
                  onClick={() => setIsChatOpenMobile(false)}
                  className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Chat Panel component */}
              <div className="flex-1 min-h-0 p-4 bg-black/20">
                <ChatPanel room={roomState} userId={userId} onSendMessage={handleSendMessage} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SIDE ADVICE FOOTER */}
      <footer className="bg-black/40 backdrop-blur-md border-t border-white/5 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-white/30 font-mono z-10 relative">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span><b>Hệ thống:</b> Hoạt động ổn định • Trễ: ~12ms</span>
        </div>
        <span>SyncAudio • Immersive Pro</span>
      </footer>
    </div>
  );
}
