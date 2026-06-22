import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Building2, LogOut, LayoutDashboard, Search, Menu, X, ShieldCheck, Bell,
  Megaphone, MessageCircle, Wrench, CreditCard, CheckCircle, CircleX,
  Medal, PartyPopper, TriangleAlert, MessageSquare, Sun, Moon, User,
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

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

const TYPE_ICON_MAP = {
  msg_broadcast:     <Megaphone     size={16} className="text-brand" />,
  msg_direct:        <MessageCircle size={16} className="text-blue-500" />,
  report:            <Wrench        size={16} className="text-amber-500" />,
  booking_paid:      <CreditCard    size={16} className="text-purple-500" />,
  booking_approved:  <CheckCircle   size={16} className="text-green-500" />,
  booking_cancelled: <CircleX       size={16} className="text-red-500" />,
  hostel_verified:   <Medal         size={16} className="text-yellow-500" />,
  verif_approved:    <PartyPopper   size={16} className="text-green-500" />,
  verif_rejected:    <TriangleAlert size={16} className="text-red-500" />,
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationDropdown({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, loadNotifications } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleClick = async (notif) => {
    if (!notif.is_read) await markRead(notif.id);
    onClose();
    if (notif.link) navigate(notif.link);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-[min(380px,_calc(100vw-1rem))] rounded-2xl border border-gray-100 bg-white shadow-2xl z-50 dark:border-gray-700 dark:bg-gray-900 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Notifications</span>
          {unreadCount > 0 && (
            <span className="badge-brand text-[11px]">{unreadCount} new</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-brand hover:underline font-medium">
              Mark all read
            </button>
          )}
          <Link to="/notifications" onClick={onClose} className="text-xs text-gray-400 hover:text-brand">
            See all →
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">No notifications yet</p>
          </div>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 transition
                hover:bg-gray-50 dark:hover:bg-gray-800/60
                ${!n.is_read ? "bg-brand/5 dark:bg-brand/10" : ""}`}
            >
              <span className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                {TYPE_ICON_MAP[n.notif_type] ?? <Bell size={16} className="text-gray-400" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${!n.is_read ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && <span className="mt-2 h-2 w-2 rounded-full bg-brand shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BellButton() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

function ChatButton() {
  const { unreadCount } = useChat();
  return (
    <Link
      to="/chat"
      aria-label="Group chats"
      className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      <MessageSquare size={17} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate("/"); };

  const dbPath  = isAuthed ? dashboardPath(user?.role) : "/login";
  const dbLabel = user?.role === "superadmin" ? "Admin" : user?.role === "manager" ? "Portal" : "Dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 h-14">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 text-brand font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white">
            <Building2 size={16} />
          </div>
          <span className="text-base">HostelHub</span>
          <span className="hidden text-xs font-normal text-gray-400 sm:inline dark:text-gray-500">Ghana</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition
              ${location.pathname === "/" ? "text-brand bg-brand/5" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
          >
            <Search size={15} /> Search
          </Link>

          {isAuthed && (
            <Link
              to={dbPath}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition
                ${location.pathname.startsWith(dbPath) ? "text-brand bg-brand/5" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"}`}
            >
              {user?.role === "superadmin" ? <ShieldCheck size={15} /> : <LayoutDashboard size={15} />}
              {dbLabel}
            </Link>
          )}

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

          <ThemeToggle />
          {isAuthed && <BellButton />}
          {isAuthed && user?.role === "student" && <ChatButton />}

          {isAuthed ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <Link to="/login" className="btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn-primary btn-sm">Get started</Link>
            </div>
          )}
        </div>

        {/* Mobile: icons + hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          {isAuthed && <BellButton />}
          {isAuthed && user?.role === "student" && <ChatButton />}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-gray-100 bg-white/98 dark:border-gray-800 dark:bg-gray-900/98 px-4 py-3 flex flex-col gap-1 sm:hidden animate-fadeIn">
          <Link to="/" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            <Search size={16} /> Search hostels
          </Link>
          {isAuthed ? (
            <>
              <Link to={dbPath} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                {user?.role === "superadmin" ? <ShieldCheck size={16} /> : <LayoutDashboard size={16} />}
                {dbLabel}
              </Link>
              {user?.role === "student" && (
                <Link to="/chat" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                  <MessageSquare size={16} /> My Groups
                </Link>
              )}
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
              <div className="px-3 py-1.5">
                <p className="text-xs text-gray-400 truncate">Signed in as <span className="font-medium text-gray-600 dark:text-gray-300">{user?.username}</span></p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                <User size={16} /> Sign in
              </Link>
              <Link to="/register" className="btn-primary w-full mt-1">Get started free</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
