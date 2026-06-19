import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import { notifApi } from "../api/endpoints.js";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthed } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const { data } = await notifApi.unreadCount();
      setUnreadCount(data.count);
    } catch {
      // silently ignore network errors for the poll
    }
  }, [isAuthed]);

  const loadNotifications = useCallback(async (params) => {
    if (!isAuthed) return;
    try {
      const { data } = await notifApi.list(params);
      setNotifications(Array.isArray(data) ? data : (data.results ?? []));
      setNextUrl(Array.isArray(data) ? null : (data.next ?? null));
    } catch {
      // ignore
    }
  }, [isAuthed]);

  const loadMoreNotifications = useCallback(async () => {
    if (!nextUrl) return;
    try {
      const { default: api } = await import("../api/axios.js");
      const { data } = await api.get(nextUrl.replace(/^.*\/api/, ""));
      setNotifications((prev) => [...prev, ...(Array.isArray(data) ? data : (data.results ?? []))]);
      setNextUrl(Array.isArray(data) ? null : (data.next ?? null));
    } catch {
      // ignore
    }
  }, [nextUrl]);

  const markRead = useCallback(async (id) => {
    try {
      await notifApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notifApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(intervalRef.current);
  // fetchUnreadCount is stable within a session; omitted to prevent interval restart on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, nextNotifUrl: nextUrl, loadNotifications, loadMoreNotifications, markRead, markAllRead, fetchUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
