import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast } from "../context/ToastContext.jsx";

const STYLES = {
  success: { bg: "bg-green-600", Icon: CheckCircle2 },
  error:   { bg: "bg-red-600",   Icon: XCircle },
  info:    { bg: "bg-gray-800",  Icon: Info },
};

function ToastPill({ toast }) {
  const { removeToast } = useToast();
  const [visible, setVisible] = useState(false);
  const { bg, Icon } = STYLES[toast.type] ?? STYLES.info;

  useEffect(() => {
    // Trigger enter animation on next tick.
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg ${bg}
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ minWidth: 260, maxWidth: 360 }}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastPill key={t.id} toast={t} />
      ))}
    </div>
  );
}
