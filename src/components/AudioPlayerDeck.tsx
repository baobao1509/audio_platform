import React, { useState, useRef, useEffect } from "react";
import { Room, DefaultTrack } from "../types";
import {
  Play,
  Pause,
  UploadCloud,
  Disc,
  Volume2,
  VolumeX,
  Music,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface AudioPlayerDeckProps {
  room: Room;
  userId: string;
  roomId: string;
  onSyncState: (isPlaying: boolean, currentTime: number, url?: string, name?: string) => void;
  defaultTracks: DefaultTrack[];
}

export default function AudioPlayerDeck({
  room,
  userId,
  roomId,
  onSyncState,
  defaultTracks,
}: AudioPlayerDeckProps) {
  const isAdmin = room.adminId === userId;
  const audioState = room.audioState || {
    url: "",
    name: "",
    isPlaying: false,
    currentTime: 0,
    lastUpdated: Date.now()
  };

  // Local state
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "drift">("synced");
  const [uploadedFiles, setUploadedFiles] = useState<{ fileName: string; name: string; url: string; size: number; createdAt: number }[]>([]);

  const fetchUploadedFiles = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/uploads");
      if (response.ok) {
        const data = await response.json();
        setUploadedFiles(data);
      }
    } catch (err) {
      console.error("Failed to fetch uploaded files:", err);
    }
  };

  useEffect(() => {
    fetchUploadedFiles();
    const interval = setInterval(fetchUploadedFiles, 4000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleDeleteFile = async (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent choosing the track when clicking delete
    if (!confirm(`Bạn có chắc chắn muốn xóa tệp này khỏi máy chủ?`)) return;

    try {
      const response = await fetch(`/api/uploads/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
        headers: {
          "x-admin-username": localStorage.getItem("sync_audio_admin_username") || "",
          "x-admin-password": localStorage.getItem("sync_audio_admin_password") || "",
        }
      });
      if (response.ok) {
        fetchUploadedFiles();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || "Không thể xóa tệp.");
      }
    } catch (err) {
      console.error("Error deleting file:", err);
      alert("Đã xảy ra lỗi khi xóa tệp.");
    }
  };

  const handleClearAllFiles = async () => {
    if (!confirm("Cảnh báo: Bạn có chắc chắn muốn xóa TOÀN BỘ các file đã tải lên máy chủ không? Hành động này không thể hoàn tác.")) return;

    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: {
          "x-admin-username": localStorage.getItem("sync_audio_admin_username") || "",
          "x-admin-password": localStorage.getItem("sync_audio_admin_password") || "",
        }
      });
      if (response.ok) {
        fetchUploadedFiles();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || "Không thể xóa sạch các tệp.");
      }
    } catch (err) {
      console.error("Error clearing all files:", err);
      alert("Đã xảy ra lỗi khi xóa sạch các tệp.");
    }
  };

  // Refs for tracking
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRemoteChangeRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize and load audio url
  useEffect(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    if (audio.src !== audioState.url) {
      console.log(`[Audio] Loading new source: ${audioState.url}`);
      isRemoteChangeRef.current = true;
      audio.src = audioState.url;
      audio.load();
    }
  }, [audioState.url]);

  // Synchronize play/pause and time updates from room state
  useEffect(() => {
    if (!audioRef.current || isAdmin) return; // Admin is the master source of truth; do not sync local player to broadcasted roomState
    const audio = audioRef.current;

    // Skip if admin is editing timeline (to prevent jumping while the admin seeks)
    const handleRemoteSync = () => {
      // 1. Synchronize Play/Pause
      if (audioState.isPlaying) {
        if (audio.paused) {
          console.log("[Sync] Triggering play programmatically");
          isRemoteChangeRef.current = true;
          setSyncStatus("syncing");
          audio.play().then(() => {
            setSyncStatus("synced");
          }).catch((err) => {
            console.warn("Auto-play blocked or failed:", err);
          });
        }
      } else {
        if (!audio.paused) {
          console.log("[Sync] Triggering pause programmatically");
          isRemoteChangeRef.current = true;
          audio.pause();
          setSyncStatus("synced");
        }
      }

      // 2. Synchronize current time with latency adjustment
      const serverTimeBase = audioState.currentTime;
      let expectedTime = serverTimeBase;

      // If playing, adjust expected time by elapsed time since last server update
      if (audioState.isPlaying) {
        const elapsedSinceUpdate = (Date.now() - audioState.lastUpdated) / 1000;
        expectedTime = serverTimeBase + elapsedSinceUpdate;
      }

      const drift = Math.abs(audio.currentTime - expectedTime);

      // If client drifted by more than 2.0 seconds, force seek
      if (drift > 2.0) {
        console.log(`[Sync] Drift detected: ${drift.toFixed(2)}s. Syncing client to: ${expectedTime.toFixed(2)}s`);
        isRemoteChangeRef.current = true;
        setSyncStatus("drift");
        audio.currentTime = expectedTime;
        setTimeout(() => setSyncStatus("synced"), 500);
      }
    };

    handleRemoteSync();
  }, [audioState.isPlaying, audioState.currentTime, audioState.lastUpdated]);

  // Handle local audio events
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  // When admin initiates Play
  const handlePlayToggle = () => {
    if (!audioRef.current || !isAdmin) return;
    const audio = audioRef.current;

    const nextPlaying = !audioState.isPlaying;

    if (nextPlaying) {
      audio.play().then(() => {
        onSyncState(true, audio.currentTime);
      });
    } else {
      audio.pause();
      onSyncState(false, audio.currentTime);
    }
  };

  // When admin seeks
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !isAdmin) return;
    const targetValue = parseFloat(e.target.value);
    
    isRemoteChangeRef.current = false;
    audioRef.current.currentTime = targetValue;
    setCurrentTime(targetValue);
    
    // Broadcast immediately
    onSyncState(audioState.isPlaying, targetValue);
  };

  // Change volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
    if (nextMute) {
      audioRef.current.volume = 0;
    } else {
      audioRef.current.volume = volume;
    }
  };

  // File upload logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("audio/")) {
      alert("Vui lòng tải lên file âm thanh hợp lệ (MP3, WAV, AAC, M4A...).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("Kích thước file tối đa là 15MB. Vui lòng thử file nhỏ hơn.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      // Upload using raw binary upload streaming
      const response = await fetch(`/api/upload?roomId=${roomId}&fileName=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": "application/octet-stream",
          "x-admin-username": localStorage.getItem("sync_audio_admin_username") || "",
          "x-admin-password": localStorage.getItem("sync_audio_admin_password") || "",
        },
      });

      setUploadProgress(70);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Lỗi máy chủ khi tải tệp.");
      }

      const data = await response.json();
      setUploadProgress(100);

      // Successfully uploaded! Trigger a sync state with the new track info
      console.log(`[Upload] File upload success: ${data.url}`);
      onSyncState(false, 0, data.url, data.name);
      fetchUploadedFiles();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Tải nhạc lên thất bại. Vui lòng kiểm tra lại đường truyền.");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 800);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Selection of preset tracks
  const handleSelectPreset = (track: DefaultTrack) => {
    if (!isAdmin) return;
    onSyncState(false, 0, track.url, track.name);
  };

  // Utility to format seconds into MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div className="glass-dark border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          if (isAdmin) {
            onSyncState(false, 0); // Reset on end
          }
        }}
      />

      {/* Decorative Aura */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full filter blur-2xl pointer-events-none" />

      {/* Header section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Hệ Thống Âm Thanh Chung</h2>
            <p className="text-[11px] text-white/40 font-mono">
              {isAdmin ? "Bạn là Quản trị viên (Admin) • Có quyền đổi nhạc" : "Bạn là Người nghe • Nhạc tự động đồng bộ"}
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 border border-white/5 text-[10px] font-mono">
          {syncStatus === "synced" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 font-medium">Đã đồng bộ</span>
            </>
          )}
          {syncStatus === "syncing" && (
            <>
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-indigo-400">Đang kết nối...</span>
            </>
          )}
          {syncStatus === "drift" && (
            <>
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-400 font-medium">Cân bằng độ trễ...</span>
            </>
          )}
        </div>
      </div>

      {/* Track info card & Visual Spinning Disc */}
      <div className="bg-black/25 border border-white/5 rounded-2xl p-4 mb-6 flex items-center gap-4">
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-full bg-[#0a0a15] border border-white/10 flex items-center justify-center text-slate-400 relative overflow-hidden shadow-inner ${
              audioState.isPlaying ? "animate-[spin_10s_linear_infinite]" : ""
            }`}
          >
            <Disc className="w-10 h-10 text-white/10" />
            <div className="absolute w-3.5 h-3.5 rounded-full bg-[#050508] border border-white/10" />
          </div>
          {audioState.isPlaying && (
            <div className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">Đang phát:</p>
          <p className="text-sm font-semibold text-white truncate pr-2" title={audioState.name}>
            {audioState.name}
          </p>
          <p className="text-[11px] text-indigo-400 font-mono mt-0.5 flex items-center gap-1.5">
            <span className="px-1.5 py-0.2 bg-indigo-500/10 rounded border border-indigo-500/20 text-[9px] uppercase">
              {audioState.url.startsWith("http") ? "Stream Link" : "File Nội bộ"}
            </span>
            <span>•</span>
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </p>
        </div>
      </div>

      {/* Progress timeline slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-[11px] font-mono text-white/40 mb-1.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeekChange}
          disabled={!isAdmin || duration === 0}
          className={`w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500 ${
            !isAdmin ? "opacity-60 cursor-not-allowed" : "hover:accent-indigo-400"
          }`}
          style={{
            background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${
              duration ? (currentTime / duration) * 100 : 0
            }%, rgb(15, 23, 42) ${duration ? (currentTime / duration) * 100 : 0}%, rgb(15, 23, 42) 100%)`,
          }}
        />
      </div>

      {/* Primary Media Controls + Volume Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-5">
        {/* Play/Pause control */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={handlePlayToggle}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-950/50"
            >
              {audioState.isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white text-white" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Phát phòng</span>
                </>
              )}
            </button>
          ) : (
            <div className="px-4 py-2.5 bg-white/3 border border-white/10 text-white/40 font-mono rounded-xl text-xs flex items-center gap-2">
              <Disc className={`w-3.5 h-3.5 ${audioState.isPlaying ? "animate-spin" : ""}`} />
              <span>{audioState.isPlaying ? "Đang phát chung..." : "Đang tạm dừng"}</span>
            </div>
          )}
        </div>

        {/* Volume & Mute slider */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button onClick={toggleMute} className="text-white/40 hover:text-white transition-colors">
            {isMuted ? <VolumeX className="w-4.5 h-4.5 text-pink-500" /> : <Volume2 className="w-4.5 h-4.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-white/60"
          />
          <span className="text-[10px] font-mono text-white/40 w-6 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>

      {/* ADMIN CONTROL PANEL: Source management */}
      {isAdmin && (
        <div className="border-t border-white/5 mt-5 pt-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 font-mono">
            Bảng Điều khiển Âm thanh (Chỉ Admin)
          </h3>

          {/* Quick Preset Selector */}
          <div>
            <span className="block text-[10px] text-white/40 mb-2 font-mono">Chọn nhanh nhạc nền thư giãn có sẵn:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {defaultTracks.map((track) => (
                <button
                  key={track.url}
                  onClick={() => handleSelectPreset(track)}
                  disabled={audioState.url === track.url}
                  className={`text-left p-2.5 rounded-xl border text-[11px] transition-all flex items-start gap-1.5 ${
                    audioState.url === track.url
                      ? "bg-indigo-500/10 border-indigo-500 text-indigo-300"
                      : "bg-white/3 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                  }`}
                >
                  <Disc className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2 leading-snug">{track.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-black/25 border border-white/5 rounded-xl p-3">
            <span className="block text-[10px] text-white/40 mb-2 font-mono">Hoặc tải file nhạc (.mp3, .wav) từ máy bạn:</span>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {isUploading ? (
              <div className="py-4 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-300 font-semibold font-mono animate-pulse">
                  Đang tải file lên phòng... {uploadProgress}%
                </p>
                <div className="w-full max-w-[200px] bg-slate-900 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={triggerFileInput}
                className="w-full py-4 border border-dashed border-white/10 hover:border-indigo-500/50 bg-white/3 hover:bg-indigo-950/10 rounded-lg transition-all flex flex-col items-center justify-center gap-1.5 group"
              >
                <UploadCloud className="w-5 h-5 text-white/30 group-hover:text-indigo-400 transition-colors" />
                <span className="text-xs font-medium text-slate-300 group-hover:text-slate-100">
                  Nhấp để tải file âm thanh của bạn lên phòng
                </span>
                <span className="text-[9px] text-white/30 font-mono">
                  Hỗ trợ MP3, WAV, FLAC, M4A... (Tối đa 15MB)
                </span>
              </button>
            )}
          </div>

          {/* Server File List */}
          <div className="bg-black/25 border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="block text-[10px] text-white/40 font-mono">
                Danh sách tệp trên máy chủ ({uploadedFiles.length}):
              </span>
              {uploadedFiles.length > 0 && (
                <button
                  onClick={handleClearAllFiles}
                  className="text-[9px] text-pink-500 hover:text-pink-400 font-semibold hover:underline font-mono"
                >
                  Xóa tất cả tệp
                </button>
              )}
            </div>

            {uploadedFiles.length === 0 ? (
              <div className="py-4 text-center border border-dashed border-white/5 rounded-lg text-slate-500 text-[11px] font-mono">
                Chưa có tệp nào tải lên máy chủ.
              </div>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {uploadedFiles.map((file) => {
                  const isCurrent = audioState.url === file.url;
                  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                  return (
                    <div
                      key={file.fileName}
                      onClick={() => onSyncState(false, 0, file.url, file.name)}
                      className={`group/item flex items-center justify-between p-2 rounded-lg text-[11px] transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-200"
                          : "bg-white/3 border border-white/5 text-slate-300 hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Disc className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent && audioState.isPlaying ? "animate-spin text-indigo-400" : "text-white/20"}`} />
                        <div className="truncate min-w-0 flex-1">
                          <p className={`font-medium truncate ${isCurrent ? "text-indigo-300 font-bold" : "text-slate-300"}`} title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[9px] text-white/30 font-mono mt-0.5">
                            {sizeInMB} MB • {new Date(file.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCurrent && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-semibold mr-1.5">
                            Đang chọn
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeleteFile(file.fileName, e)}
                          className="p-1 text-white/30 hover:text-pink-500 hover:bg-pink-500/10 rounded transition-all"
                          title="Xóa tệp khỏi máy chủ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety info disclaimer */}
      {!isAdmin && (
        <div className="mt-5 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-start gap-2 text-indigo-300 text-[10px] leading-relaxed">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-400" />
          <span>
            <b>Đang nghe chung!</b> Máy bạn sẽ tự phát nhạc và di chuyển thanh thời gian đúng theo vị trí của quản trị viên. Hãy điều chỉnh âm lượng riêng của bạn ở góc phải nếu cần.
          </span>
        </div>
      )}
    </div>
  );
}
