import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext.jsx";
import { notifApi } from "../api/endpoints.js";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthed } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
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
    } catch {
      // ignore
    }
  }, [isAuthed]);

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
  }, [isAuthed, fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, loadNotifications, markRead, markAllRead, fetchUnreadCount }}
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
