import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import { chatApi } from "../api/endpoints.js";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { isAuthed } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, author_username, body_preview }

  const countPollRef = useRef(null);
  const msgPollRef   = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await chatApi.unreadCount();
      setUnreadCount(data.count);
    } catch { /* silently ignore */ }
  }, [isAuthed]);

  const loadRooms = useCallback(async () => {
    if (!isAuthed) return;
    setLoadingRooms(true);
    try {
      const { data } = await chatApi.rooms();
      setRooms(Array.isArray(data) ? data : (data.results ?? []));
    } catch { /* ignore */ } finally {
      setLoadingRooms(false);
    }
  }, [isAuthed]);

  const loadMessages = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const { data } = await chatApi.messages(roomId, { limit: 30 });
      const msgs = Array.isArray(data) ? data : (data.results ?? []);
      setMessages([...msgs].reverse()); // API newest-first → display oldest-first (newest at bottom)
    } catch { /* ignore */ }
  }, []);

  const markRead = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      await chatApi.markRead(roomId);
      setRooms((prev) =>
        prev.map((r) => r.id === roomId ? { ...r, unread_count: 0 } : r)
      );
      fetchUnreadCount();
    } catch { /* ignore */ }
  }, [fetchUnreadCount]);

  const sendMessage = useCallback(async (roomId, body, replyToId = null) => {
    await chatApi.postMessage(roomId, { body, reply_to: replyToId });
    setReplyTo(null);
    await loadMessages(roomId);
    await markRead(roomId);
    // Refresh room list so last_message preview updates
    loadRooms();
  }, [loadMessages, markRead, loadRooms]);

  const toggleReaction = useCallback(async (msgId, emoji) => {
    try {
      const { data } = await chatApi.react(msgId, emoji);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, reactions_summary: data.reactions } : m)
      );
    } catch { /* ignore */ }
  }, []);

  // 30s unread count poll
  useEffect(() => {
    if (!isAuthed) { setUnreadCount(0); setRooms([]); return; }
    fetchUnreadCount();
    loadRooms();
    countPollRef.current = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(countPollRef.current);
  }, [isAuthed, fetchUnreadCount, loadRooms]);

  // 10s message poll when a room is open
  useEffect(() => {
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    if (!activeRoomId) { setMessages([]); return; }

    setLoadingMessages(true);
    loadMessages(activeRoomId).finally(() => setLoadingMessages(false));
    markRead(activeRoomId);

    msgPollRef.current = setInterval(() => loadMessages(activeRoomId), 10_000);
    return () => clearInterval(msgPollRef.current);
  }, [activeRoomId, loadMessages, markRead]);

  return (
    <ChatContext.Provider value={{
      rooms, activeRoomId, setActiveRoomId,
      messages, unreadCount,
      loadingRooms, loadingMessages,
      replyTo, setReplyTo,
      sendMessage, toggleReaction, markRead,
      loadRooms, loadMessages,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
