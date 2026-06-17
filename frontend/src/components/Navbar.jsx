import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, LogOut, LayoutDashboard, Search, Menu, X, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

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
        className="flex items-center gap-1 text-gray-600 hover:text-brand">
        {user?.role === "superadmin" ? <ShieldCheck size={16}/> : <LayoutDashboard size={16}/>}
        {dashboardLabel(user?.role)}
      </Link>
      <button onClick={handleLogout} className="flex items-center gap-1 text-gray-600 hover:text-brand">
        <LogOut size={16}/> Logout
      </button>
    </>
  ) : (
    <Link to="/login" onClick={close} className="btn-primary px-3 py-1.5 text-sm">
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-brand">
          <Building2 size={24}/>
          <span className="text-lg font-bold">HostelHub</span>
          <span className="hidden text-xs text-gray-400 sm:inline">Ghana</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-3 text-sm sm:flex">
          <Link to="/" className="flex items-center gap-1 text-gray-600 hover:text-brand">
            <Search size={16}/> Search
          </Link>
          {authLinks}
        </div>

        {/* Mobile hamburger */}
        <button className="sm:hidden text-gray-600" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-gray-200 bg-white/95 px-4 py-3 flex flex-col gap-3 text-sm sm:hidden">
          <Link to="/" onClick={close} className="flex items-center gap-1 text-gray-600 hover:text-brand">
            <Search size={16}/> Search
          </Link>
          {authLinks}
        </div>
      )}
    </header>
  );
}
