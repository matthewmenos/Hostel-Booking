import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2, LogOut, LayoutDashboard, Search, Menu, X, ShieldCheck, Bell,
  Megaphone, MessageCircle, Wrench, CreditCard, CheckCircle, CircleX,
  Medal, Circle, PartyPopper, TriangleAlert, MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useNotifications } from "../context/NotificationContext.jsx";
import { useChat } from "../context/ChatContext.jsx";

function dashboardPath(role) {
  if (role === "superadmin") return "/admin";
  if (role === "manager") return "/manager";
  return "/dashboard";
}

function dashboardLabel(role) {
  if (role === "superadmin") return "Admin";
  if (role === "manager") return "Manager";
  return "Dashboard";
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-brand dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-light ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const TYPE_ICON_MAP = {
  msg_broadcast:    <Megaphone      size={18} className="text-brand" />,
  msg_direct:       <MessageCircle  size={18} className="text-blue-500" />,
  report:           <Wrench         size={18} className="text-amber-500" />,
  booking_paid:     <CreditCard     size={18} className="text-purple-500" />,
  booking_approved: <CheckCircle    size={18} className="text-green-500" />,
  booking_cancelled:<CircleX        size={18} className="text-red-500" />,
  hostel_verified:  <Medal          size={18} className="text-yellow-500" />,
  hostel_activated: <Circle         size={18} className="fill-green-500 text-green-500" />,
  hostel_deactivated:<Circle        size={18} className="fill-red-500 text-red-500" />,
  verif_approved:   <PartyPopper    size={18} className="text-green-500" />,
  verif_rejected:   <TriangleAlert  size={18} className="text-red-500" />,
};

function NotifIcon({ type }) {
  return (
    <span className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
      {TYPE_ICON_MAP[type] ?? <Bell size={18} className="text-gray-400" />}
    </span>
  );
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationDropdown({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, loadNotifications } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    onClose();
    if (notif.link) navigate(notif.link);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-2xl z-50 dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <span className="font-semibold text-sm">Notifications</span>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand hover:underline"
            >
              Mark all read
            </button>
          )}
          <Link
            to="/notifications"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-brand"
          >
            See all
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No notifications yet</div>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${!n.is_read ? "bg-brand/5 dark:bg-brand/10" : ""}`}
            >
              <NotifIcon type={n.notif_type} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${!n.is_read ? "font-semibold" : ""}`}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <span className="mt-1.5 h-2 w-2 rounded-full bg-brand shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BellButton({ className = "" }) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-brand dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-light"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChatButton({ className = "" }) {
  const { unreadCount } = useChat();
  return (
    <Link
      to="/chat"
      aria-label="Group chats"
      className={`relative rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-brand dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-light ${className}`}
    >
      <MessageSquare size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    close();
    navigate("/");
  };

  const authLinks = isAuthed ? (
    <>
      <Link to={dashboardPath(user?.role)} onClick={close}
        className="flex items-center gap-1 text-gray-600 hover:text-brand dark:text-gray-300 dark:hover:text-brand-light">
        {user?.role === "superadmin" ? <ShieldCheck size={16}/> : <LayoutDashboard size={16}/>}
        {dashboardLabel(user?.role)}
      </Link>
      <button onClick={handleLogout}
        className="flex items-center gap-1 text-gray-600 hover:text-brand dark:text-gray-300 dark:hover:text-brand-light">
        <LogOut size={16}/> Logout
      </button>
    </>
  ) : (
    <Link to="/login" onClick={close} className="btn-primary px-3 py-1.5 text-sm">
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-brand">
          <Building2 size={24}/>
          <span className="text-lg font-bold">HostelHub</span>
          <span className="hidden text-xs text-gray-400 sm:inline dark:text-gray-500">Ghana</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <Link to="/" className="flex items-center gap-1 text-gray-600 hover:text-brand dark:text-gray-300 dark:hover:text-brand-light">
            <Search size={16}/> Search
          </Link>
          {authLinks}
          <ThemeToggle />
          {isAuthed && <BellButton />}
          {isAuthed && user?.role === "student" && <ChatButton />}
        </div>

        {/* Mobile: theme toggle + bell + hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          {isAuthed && <BellButton />}
          {isAuthed && user?.role === "student" && <ChatButton />}
          <button className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => setOpen((v) => !v)}>
            {open ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-gray-200 bg-white/95 px-4 py-3 flex flex-col gap-3 text-sm sm:hidden dark:border-gray-700 dark:bg-gray-900/95">
          <Link to="/" onClick={close}
            className="flex items-center gap-1 text-gray-600 hover:text-brand dark:text-gray-300 dark:hover:text-brand-light">
            <Search size={16}/> Search
          </Link>
          {authLinks}
        </div>
      )}
    </header>
  );
}
