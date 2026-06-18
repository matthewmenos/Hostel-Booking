import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MessageSquare, Users, ArrowLeft, Send, X, SmilePlus,
} from "lucide-react";
import { useChat } from "../context/ChatContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "✅"];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ initials }) {
  return (
    <div className="h-8 w-8 shrink-0 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand select-none">
      {initials}
    </div>
  );
}

function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref}
      className="absolute bottom-7 left-0 z-50 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-2 grid grid-cols-4 gap-1">
      {QUICK_EMOJIS.map((emoji) => (
        <button key={emoji} onClick={() => { onPick(emoji); onClose(); }}
          className="text-xl p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function MessageItem({ msg, onReply, onReact }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="flex items-start gap-2.5 group">
      <Avatar initials={msg.author_initials} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{msg.author_username}</span>
          <span className="text-xs text-gray-400">{timeAgo(msg.created_at)}</span>
          <button
            onClick={() => onReply({ id: msg.id, author_username: msg.author_username, body_preview: msg.body.slice(0, 80) })}
            className="ml-auto opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-brand transition"
          >
            Reply
          </button>
        </div>

        {msg.reply_to_preview && (
          <div className="border-l-2 border-gray-300 dark:border-gray-600 pl-2 mb-1 text-xs text-gray-500 truncate">
            <span className="font-medium">@{msg.reply_to_preview.author_username}</span>
            {" "}{msg.reply_to_preview.body_preview}
          </div>
        )}

        <p className="text-sm break-words">{msg.body}</p>

        <div className="flex flex-wrap items-center gap-1 mt-1.5 relative">
          {(msg.reactions_summary ?? []).map((r) => (
            <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition
                ${r.reacted
                  ? "border-brand bg-brand/10 text-brand font-semibold"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400"}`}>
              {r.emoji} {r.count}
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowPicker((v) => !v)}
              className="flex items-center px-1.5 py-0.5 rounded-full text-xs border border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-400 transition">
              <SmilePlus size={12} />
            </button>
            {showPicker && (
              <EmojiPicker
                onPick={(emoji) => onReact(msg.id, emoji)}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatWindow({ room }) {
  const { messages, loadingMessages, replyTo, setReplyTo, sendMessage, toggleReaction } = useChat();
  const { addToast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendMessage(room.id, body.trim(), replyTo?.id ?? null);
      setBody("");
    } catch {
      addToast("error", "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
        <div>
          <p className="font-semibold text-sm">{room.name}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Users size={11} /> {room.member_count} member{room.member_count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loadingMessages && messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <span className="h-6 w-6 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
            <MessageSquare size={32} />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onReply={setReplyTo}
              onReact={toggleReaction}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2 text-sm">
          <span className="text-brand shrink-0">↩</span>
          <span className="text-gray-500 truncate flex-1">
            <span className="font-medium text-gray-700 dark:text-gray-300">@{replyTo.author_username}:</span>{" "}
            {replyTo.body_preview}
          </span>
          <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Compose */}
      <form onSubmit={handleSend}
        className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-end gap-2 shrink-0">
        <textarea
          className="input flex-1 resize-none min-h-[40px] max-h-32 py-2 text-sm"
          placeholder="Type a message…"
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="btn-primary px-3 py-2 shrink-0 disabled:opacity-50">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function GroupSidebar({ activeRoomId, onSelect }) {
  const { rooms, loadingRooms } = useChat();

  if (loadingRooms) return (
    <div className="flex justify-center py-10">
      <span className="h-6 w-6 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );

  if (rooms.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-16 px-4 text-gray-400 text-center">
      <MessageSquare size={32} />
      <p className="text-sm">No groups yet.</p>
      <p className="text-xs">Your groups appear here once your booking is approved.</p>
    </div>
  );

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelect(room.id)}
          className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition
            ${activeRoomId === room.id ? "bg-brand/5 dark:bg-brand/10 border-l-2 border-brand" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{room.name}</span>
            {room.unread_count > 0 && (
              <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {room.unread_count > 9 ? "9+" : room.unread_count}
              </span>
            )}
          </div>
          {room.last_message ? (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              <span className="font-medium">{room.last_message.author_username}:</span>{" "}
              {room.last_message.body_preview}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5 italic">No messages yet</p>
          )}
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 flex items-center gap-1">
            <Users size={10} /> {room.member_count}
          </p>
        </button>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { rooms, setActiveRoomId, activeRoomId } = useChat();
  const [mobileView, setMobileView] = useState("sidebar"); // "sidebar" | "chat"

  // Sync URL param → context
  useEffect(() => {
    if (groupId) {
      const id = parseInt(groupId, 10);
      setActiveRoomId(id);
      setMobileView("chat");
    } else {
      setActiveRoomId(null);
      setMobileView("sidebar");
    }
  }, [groupId, setActiveRoomId]);

  const handleSelectRoom = (id) => {
    navigate(`/chat/${id}`, { replace: true });
  };

  const handleBack = () => {
    navigate("/chat", { replace: true });
  };

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <div className="flex h-[calc(100vh-64px)] -my-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">

      {/* Sidebar — hidden on mobile when chat is open */}
      <aside className={`w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col
        ${mobileView === "chat" ? "hidden sm:flex" : "flex"}`}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare size={16} className="text-brand" /> My Groups
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <GroupSidebar activeRoomId={activeRoomId} onSelect={handleSelectRoom} />
        </div>
      </aside>

      {/* Chat panel */}
      <main className={`flex-1 flex flex-col min-w-0
        ${mobileView === "sidebar" ? "hidden sm:flex" : "flex"}`}>
        {/* Mobile back button */}
        <div className="sm:hidden px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <button onClick={handleBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
            <ArrowLeft size={16} /> Back to groups
          </button>
        </div>

        {activeRoom ? (
          <ChatWindow room={activeRoom} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <MessageSquare size={40} />
            <p className="text-sm">Select a group to start chatting</p>
          </div>
        )}
      </main>
    </div>
  );
}
