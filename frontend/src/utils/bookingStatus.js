import { CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";

export const STATUS_UI = {
  paid:      { icon: CheckCircle2, cls: "text-green-600",  label: "Paid" },
  pending:   { icon: Clock,        cls: "text-amber-600",  label: "Pending payment" },
  failed:    { icon: XCircle,      cls: "text-red-600",    label: "Failed" },
  expired:   { icon: XCircle,      cls: "text-gray-400",   label: "Expired" },
  refunded:  { icon: RefreshCw,    cls: "text-blue-500",   label: "Refunded" },
};
