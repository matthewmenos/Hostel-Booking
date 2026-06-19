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
  const [replyTo, setReplyTo] = useState(null);

  const countPollRef  = useRef(null);
  const msgPollRef    = useRef(null);
  // Tracks which room's messages are currently "expected" to prevent stale overwrites
  const activeRoomRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await chatApi.unreadCount();
      setUnreadCount(data.count);
    } catch { /* ignore */ }
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
      // Discard if user switched rooms while this request was in-flight
      if (activeRoomRef.current === roomId) {
        setMessages([...msgs].reverse());
      }
    } catch { /* ignore */ }
  }, []);

  const markRead = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      await chatApi.markRead(roomId);
      setRooms((prev) =>
        prev.map((r) => r.id === roomId ? { ...r, unread_count: 0 } : r)
      );
      // Use functional update to avoid stale closure on fetchUnreadCount
      chatApi.unreadCount().then(({ data }) => setUnreadCount(data.count)).catch(() => {});
    } catch { /* ignore */ }
  }, []);

  const sendMessage = useCallback(async (roomId, body, replyToId = null) => {
    await chatApi.postMessage(roomId, { body, reply_to: replyToId });
    setReplyTo(null);
    await loadMessages(roomId);
    await markRead(roomId);
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

  // 30s unread count + rooms poll — only depends on isAuthed (stable primitive)
  useEffect(() => {
    if (!isAuthed) {
      setUnreadCount(0);
      setRooms([]);
      return;
    }
    fetchUnreadCount();
    loadRooms();
    countPollRef.current = setInterval(() => {
      fetchUnreadCount();
    }, 30_000);
    return () => clearInterval(countPollRef.current);
  // fetchUnreadCount and loadRooms are stable within an isAuthed session;
  // intentionally omitted from deps to avoid restarting the poll on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // 10s message poll — only restarts when the active room actually changes
  useEffect(() => {
    clearInterval(msgPollRef.current);
    activeRoomRef.current = activeRoomId;

    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    loadMessages(activeRoomId).finally(() => setLoadingMessages(false));
    markRead(activeRoomId);

    msgPollRef.current = setInterval(() => loadMessages(activeRoomId), 10_000);
    return () => clearInterval(msgPollRef.current);
  // loadMessages and markRead have stable identities (no deps that change mid-session).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

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
