import React, { useState, useRef, useEffect } from "react";
import { Room } from "../types";
import { MessageSquare, Users, Send, Crown, Circle, HelpCircle } from "lucide-react";

interface ChatPanelProps {
  room: Room;
  userId: string;
  onSendMessage: (text: string) => void;
  isMobileVariant?: boolean;
}

export default function ChatPanel({ room, userId, onSendMessage, isMobileVariant = false }: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "users">("chat");
  const [messageText, setMessageText] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom of chat only when messages count or last message content changes
  const messagesLength = room.chatMessages.length;
  const lastMessageId = messagesLength > 0 ? room.chatMessages[messagesLength - 1].id : "";

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesLength, lastMessageId, activeTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    onSendMessage(messageText.trim());
    setMessageText("");
  };

  const activeParticipants = Object.values(room.participants);

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isMobileVariant ? "" : "glass-dark border border-white/5 rounded-2xl shadow-xl"}`}>
      {/* Sidebar Navigation Tabs */}
      <div className="flex border-b border-white/5 bg-black/25 p-2 gap-1.5">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "chat"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Trò chuyện</span>
          {room.chatMessages.length > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {room.chatMessages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "users"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Thành viên</span>
          <span className="bg-white/5 border border-white/10 text-white/60 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {activeParticipants.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: Chat Room */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
          {/* Chat log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {room.chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageSquare className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-xs text-white/60 font-semibold">Phòng chat trống</p>
                <p className="text-[10px] text-white/40 max-w-[180px] mt-1 leading-relaxed">
                  Hãy gửi lời chào đầu tiên để trò chuyện cùng mọi người nhé!
                </p>
              </div>
            ) : (
              room.chatMessages.map((msg) => {
                const isMe = msg.senderId === userId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-white/40">
                        {msg.senderName}
                      </span>
                      {room.adminId === msg.senderId && (
                        <Crown className="w-3 h-3 text-amber-400 animate-pulse" />
                      )}
                      <span className="text-[9px] text-white/20 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-white/5 text-white/90 border border-white/5 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSend} className="p-3 bg-black/20 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Nhập nội dung trò chuyện..."
              className="flex-1 px-3.5 py-2 bg-white/5 border border-white/10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-white/20"
            />
            <button
              type="submit"
              className="p-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl transition-all shadow-md"
            >
              <Send className="w-4 h-4 fill-white text-white" />
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT: Members Directory */}
      {activeTab === "users" && (
        <div className="flex-1 overflow-y-auto p-4 bg-transparent space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-2">
            Người tham gia ({activeParticipants.length})
          </div>

          <div className="space-y-2">
            {activeParticipants.map((p) => {
              const isMe = p.id === userId;
              const isUserAdmin = p.role === "admin";
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-xs border border-white/10">
                        {p.name[0].toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isMe && (
                          <span className="text-[8px] bg-white/10 text-indigo-300 px-1 rounded uppercase font-mono font-bold">
                            Tôi
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-white/30 font-mono mt-0.5">
                        Vào phòng: {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Role badges on right */}
                  <div>
                    {isUserAdmin ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <Crown className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-white/40 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
                        Listener
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
