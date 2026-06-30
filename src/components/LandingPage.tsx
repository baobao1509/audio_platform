import React, { useState } from "react";
import { motion } from "motion/react";
import { Music, Radio, LogIn, Sparkles } from "lucide-react";

interface LandingPageProps {
  onJoinRoom: (roomId: string, name: string, role: "admin" | "listener") => void;
  onCreateRoom: (name: string) => void;
  error?: string;
}

export default function LandingPage({ onJoinRoom, onCreateRoom, error }: LandingPageProps) {
  const [name, setName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [role, setRole] = useState<"admin" | "listener">("listener");
  const [isJoining, setIsJoining] = useState(false);
  const [inputError, setInputError] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setInputError("Vui lòng nhập tên của bạn trước khi tạo phòng.");
      return;
    }
    setInputError("");
    onCreateRoom(name.trim());
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setInputError("Vui lòng nhập tên của bạn trước khi tham gia.");
      return;
    }
    if (!roomIdInput.trim() || roomIdInput.trim().length !== 6) {
      setInputError("Mã phòng phải gồm đúng 6 ký tự.");
      return;
    }
    setInputError("");
    onJoinRoom(roomIdInput.trim().toUpperCase(), name.trim(), role);
  };

  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans">
      {/* Immersive UI Radial Glows */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_#1a1a2e_0%,_#050508_100%)] pointer-events-none" />
      <div className="glow glow-indigo top-[-100px] left-[-100px] w-[500px] h-[500px]" />
      <div className="glow glow-pink bottom-[-100px] right-[-100px] w-[500px] h-[500px]" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md glass backdrop-blur-2xl rounded-[24px] p-8 shadow-2xl z-10 border-white/8"
      >
        {/* App Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30 mb-4 border border-white/10">
            <Radio className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white">
            SyncAudio <span className="font-semibold text-indigo-400">Room</span>
          </h1>
          <p className="text-[11px] text-white/40 mt-1.5 uppercase tracking-widest font-mono">
            Synced Audio Experience
          </p>
        </div>

        {/* Informational Note */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4.5 mb-6 text-sm text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1.5 text-xs uppercase tracking-wider font-mono">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>Ý tưởng khả thi 100%!</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Ứng dụng này cho phép tạo các phòng họp ảo. <b>Quản trị viên (Admin)</b> có thể tải lên file âm thanh (.mp3, .wav) hoặc chọn playlist. Âm thanh sẽ được <b>đồng bộ tuyệt đối</b> đến từng giây cho tất cả người nghe cùng phòng!
          </p>
        </div>

        {/* Global Error Banner */}
        {(error || inputError) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-3 bg-red-950/40 border border-red-950 rounded-xl text-red-200 text-xs text-center"
          >
            {error || inputError}
          </motion.div>
        )}

        {/* Shared User Identity Input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
            Tên của bạn:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setInputError("");
            }}
            placeholder="Ví dụ: Bảo Nam, Lan Anh..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl transition-all duration-200 text-slate-100 placeholder-slate-600 text-sm font-medium"
          />
        </div>

        {/* Action Tabs */}
        <div className="grid grid-cols-2 gap-4 mb-8 border-b border-white/5 pb-6">
          {/* Create Room Tab Box */}
          <div className="flex flex-col justify-between">
            <div className="mb-3 text-xs text-white/40 text-center font-mono uppercase tracking-wider">
              Bắt đầu phòng mới
            </div>
            <button
              onClick={handleCreate}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-950/50 flex items-center justify-center gap-2"
            >
              <Music className="w-4 h-4" />
              Tạo phòng mới
            </button>
          </div>

          {/* Join Room Tab Box */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-white/40 text-center font-mono uppercase tracking-wider">
              Tham gia phòng có sẵn
            </div>
            <button
              onClick={() => setIsJoining(true)}
              className="w-full py-3 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-slate-200 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 border border-white/10"
            >
              <LogIn className="w-4 h-4" />
              Vào phòng đã có
            </button>
          </div>
        </div>

        {/* Join Room Modal/Form Overlay when clicking "Join" */}
        {isJoining && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-slate-800 pt-6 mt-2"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-pink-400" />
              Nhập mã phòng để tham gia
            </h3>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Mã phòng (6 ký tự):
                </label>
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => {
                    setRoomIdInput(e.target.value.toUpperCase());
                    setInputError("");
                  }}
                  placeholder="Ví dụ: AB39X2"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 rounded-xl transition-all duration-200 text-slate-100 placeholder-slate-600 text-sm font-mono tracking-widest text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Vai trò của bạn:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("listener")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      role === "listener"
                        ? "bg-pink-500/10 border-pink-500 text-pink-200"
                        : "bg-white/3 border-white/8 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    Người nghe (Khán giả)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                      role === "admin"
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-200"
                        : "bg-white/3 border-white/8 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    Quản trị viên (Admin phụ)
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoining(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl text-sm transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-xl text-sm shadow-md shadow-pink-950/50 transition-all"
                >
                  Tham gia ngay
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </motion.div>

      {/* Footer Design Credit */}
      <div className="text-slate-600 text-xs mt-8 z-10 font-mono flex items-center gap-1.5">
        <span>SyncAudio Room v1.0.0</span>
        <span>•</span>
        <span>Môi trường trực tuyến 3D Soundscape</span>
      </div>
    </div>
  );
}
