import { Link } from "react-router-dom";
import { Building2, Home, Search } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-brand/10 p-5 text-brand">
        <Building2 size={48} />
      </div>
      <h1 className="text-5xl font-extrabold text-gray-200">404</h1>
      <h2 className="mt-2 text-xl font-semibold text-gray-800">Page not found</h2>
      <p className="mt-2 max-w-sm text-gray-500">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary flex items-center gap-1.5 px-4 py-2">
          <Home size={16} /> Go home
        </Link>
        <Link to="/" className="btn-ghost flex items-center gap-1.5 px-4 py-2">
          <Search size={16} /> Search hostels
        </Link>
      </div>
    </div>
  );
}
