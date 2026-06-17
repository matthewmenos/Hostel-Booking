import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, LogOut, LayoutDashboard, Search, Menu, X, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

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
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
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
