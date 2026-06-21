import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Megaphone, MessageCircle, Wrench, CreditCard, CheckCircle, CircleX,
  Medal, Circle, PartyPopper, TriangleAlert,
} from "lucide-react";
import { useNotifications } from "../context/NotificationContext.jsx";

const TABS = [
  { key: "all",      label: "All" },
  { key: "unread",   label: "Unread" },
  { key: "messages", label: "Messages" },
  { key: "reports",  label: "Reports" },
  { key: "system",   label: "System" },
];

const TYPE_ICON_MAP = {
  msg_broadcast:    <Megaphone      size={20} className="text-brand" />,
  msg_direct:       <MessageCircle  size={20} className="text-blue-500" />,
  report:           <Wrench         size={20} className="text-amber-500" />,
  booking_paid:     <CreditCard     size={20} className="text-purple-500" />,
  booking_approved: <CheckCircle    size={20} className="text-green-500" />,
  booking_cancelled:<CircleX        size={20} className="text-red-500" />,
  hostel_verified:  <Medal          size={20} className="text-yellow-500" />,
  hostel_activated: <Circle         size={20} className="fill-green-500 text-green-500" />,
  hostel_deactivated:<Circle        size={20} className="fill-red-500 text-red-500" />,
  verif_approved:   <PartyPopper    size={20} className="text-green-500" />,
  verif_rejected:   <TriangleAlert  size={20} className="text-red-500" />,
};

function NotifIcon({ type }) {
  return (
    <span className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
      {TYPE_ICON_MAP[type] ?? <Bell size={20} className="text-gray-400" />}
    </span>
  );
}

const MESSAGE_TYPES = ["msg_broadcast", "msg_direct"];
const REPORT_TYPES  = ["report"];
const SYSTEM_TYPES  = [
  "booking_paid", "booking_approved", "booking_cancelled",
  "hostel_verified", "hostel_activated", "hostel_deactivated",
  "verif_approved", "verif_rejected",
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, nextNotifUrl, markRead, markAllRead, loadNotifications, loadMoreNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false));
  }, [loadNotifications]);

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread")   return !n.is_read;
    if (activeTab === "messages") return MESSAGE_TYPES.includes(n.notif_type);
    if (activeTab === "reports")  return REPORT_TYPES.includes(n.notif_type);
    if (activeTab === "system")   return SYSTEM_TYPES.includes(n.notif_type);
    return true;
  });

  const handleClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell size={22} className="text-brand" />
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-brand hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
              activeTab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
          <Bell size={36} />
          <p className="text-sm">No notifications here</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${
                  !n.is_read ? "bg-brand/5 dark:bg-brand/10" : "bg-white dark:bg-gray-900"
                }`}
              >
                <NotifIcon type={n.notif_type} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? "font-semibold" : ""}`}>{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 whitespace-pre-wrap break-words">
                      {n.body}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                    {n.sender_username && (
                      <span className="text-xs text-gray-400">· from {n.sender_username}</span>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <span className="mt-2 h-2 w-2 rounded-full bg-brand shrink-0" />
                )}
              </button>
            ))}
          </div>
          {activeTab === "all" && nextNotifUrl && (
            <button
              onClick={loadMoreNotifications}
              className="btn-ghost w-full py-3 text-sm mt-2 min-h-[44px]"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
