import { Link } from "react-router-dom";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ErrorPage({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-red-50 p-5 text-red-400">
        <AlertTriangle size={40} />
      </div>
      <h2 className="text-xl font-semibold text-gray-800">Oops!</h2>
      <p className="mt-2 max-w-sm text-gray-500">{message}</p>
      <div className="mt-6 flex gap-3">
        {onRetry && (
          <button onClick={onRetry} className="btn-primary flex items-center gap-1.5 px-4 py-2">
            <RefreshCw size={16} /> Try again
          </button>
        )}
        <Link to="/" className="btn-ghost flex items-center gap-1.5 px-4 py-2">
          <Home size={16} /> Go home
        </Link>
      </div>
    </div>
  );
}
