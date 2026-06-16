import { Link, useNavigate } from "react-router-dom";
import { Building2, LogOut, LayoutDashboard, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, isAuthed, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-brand">
          <Building2 size={24} />
          <span className="text-lg font-bold">HostelHub</span>
          <span className="hidden text-xs text-gray-400 sm:inline">Ghana</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link to="/" className="flex items-center gap-1 text-gray-600 hover:text-brand">
            <Search size={16} /> Search
          </Link>
          {isAuthed ? (
            <>
              <Link
                to={user?.role === "manager" ? "/manager" : "/dashboard"}
                className="flex items-center gap-1 text-gray-600 hover:text-brand"
              >
                <LayoutDashboard size={16} />
                {user?.role === "manager" ? "Manager" : "Dashboard"}
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-1 text-gray-600 hover:text-brand">
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary px-3 py-1.5 text-sm">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
