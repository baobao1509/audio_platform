import { Participant } from "../types";
import { Mic, MicOff, Video, VideoOff, Crown, Headset, Volume2 } from "lucide-react";

interface ParticipantCardProps {
  participant: Participant;
  isCurrentUser: boolean;
  isAudioPlaying: boolean;
  isAdmin: boolean;
}

// Colors list to assign beautiful consistent avatars based on participant name
const AVATAR_COLORS = [
  "from-pink-500 to-rose-600 shadow-pink-500/20",
  "from-purple-500 to-indigo-600 shadow-purple-500/20",
  "from-blue-500 to-sky-600 shadow-blue-500/20",
  "from-emerald-500 to-teal-600 shadow-emerald-500/20",
  "from-amber-500 to-orange-600 shadow-amber-500/20",
];

function getAvatarStyles(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default function ParticipantCard({
  participant,
  isCurrentUser,
  isAudioPlaying,
  isAdmin,
}: ParticipantCardProps) {
  const isUserAdmin = participant.role === "admin";
  const avatarStyle = getAvatarStyles(participant.name);
  const initials = participant.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      id={`participant-${participant.id}`}
      className={`relative rounded-2xl glass-dark border overflow-hidden aspect-[4/3] flex flex-col items-center justify-center p-6 shadow-xl transition-all duration-300 ${
        isUserAdmin
          ? "border-indigo-500/30 shadow-indigo-950/20"
          : "border-white/5 shadow-black/40"
      }`}
    >
      {/* Background Subtle Stream Mock */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a12]/80 via-[#050508]/90 to-[#050508] opacity-90 z-0" />

      {/* Visual Waveform Aura when Audio is Playing */}
      {isAudioPlaying && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-40 h-40 rounded-full bg-indigo-500/5 animate-ping duration-[3000ms]" />
          <div className="absolute w-32 h-32 rounded-full bg-pink-500/5 animate-pulse" />
        </div>
      )}

      {/* Meet Participant Box */}
      <div className="relative z-10 flex flex-col items-center">
        {/* User Large Avatar */}
        <div
          className={`w-20 h-20 rounded-full bg-gradient-to-tr ${avatarStyle} flex items-center justify-center text-white text-2xl font-bold shadow-md mb-3 border-2 border-white/10 relative`}
        >
          {initials || "?"}

          {/* Role badge marker on Avatar */}
          <div className="absolute -bottom-1 -right-1 p-1 bg-[#050508] rounded-full border border-white/10">
            {isUserAdmin ? (
              <Crown className="w-4 h-4 text-amber-400" />
            ) : (
              <Headset className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        </div>

        {/* User Name & Me Flag */}
        <div className="flex items-center gap-1.5 justify-center mb-1">
          <span className="text-white font-semibold text-sm max-w-[150px] truncate">
            {participant.name}
          </span>
          {isCurrentUser && (
            <span className="px-1.5 py-0.5 bg-white/10 text-[10px] text-indigo-300 font-mono rounded-md border border-white/10 font-bold uppercase">
              Tôi
            </span>
          )}
        </div>

        {/* User Role text */}
        <div className="flex items-center gap-1">
          {isUserAdmin ? (
            <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              Quản trị viên
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-white/60 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
              Thành viên
            </span>
          )}
        </div>
      </div>

      {/* Equalizer animation: Bottom indicator when audio is playing */}
      {isAudioPlaying && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/40 border border-indigo-500/20 rounded-lg backdrop-blur-md">
          <Volume2 className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
          <span className="text-[10px] font-mono font-medium text-indigo-300">Đang nghe</span>
          
          {/* Waveform columns */}
          <div className="flex items-end gap-[2px] h-3 ml-2">
            <span className="w-[2px] bg-indigo-400 rounded-full animate-[wave_0.8s_ease-in-out_infinite] h-1" style={{ animationDelay: "0.1s" }} />
            <span className="w-[2px] bg-indigo-400 rounded-full animate-[wave_0.8s_ease-in-out_infinite] h-3" style={{ animationDelay: "0.3s" }} />
            <span className="w-[2px] bg-indigo-400 rounded-full animate-[wave_0.8s_ease-in-out_infinite] h-2" style={{ animationDelay: "0.5s" }} />
          </div>
        </div>
      )}

      {/* Meet-style audio/video hardware overlay icons on top-right */}
      <div className="absolute top-4 right-4 z-10 flex gap-1.5">
        <div className="p-1.5 bg-[#050508]/80 border border-white/10 rounded-lg text-slate-400 backdrop-blur-md">
          <Mic className="w-3.5 h-3.5" />
        </div>
        <div className="p-1.5 bg-[#050508]/80 border border-white/10 rounded-lg text-slate-400 backdrop-blur-md">
          <VideoOff className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
