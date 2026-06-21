import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck, Users, Building2, BookOpen, BadgeCheck,
  BarChart2, CreditCard, Wallet, Settings, TrendingUp, UserCheck,
  CheckCircle2, XCircle, Clock, ExternalLink,
} from "lucide-react";
import { adminApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonBookingRow, SkeletonCard, SkeletonStatCard } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";

const TABS = [
  { id: "overview",       label: "Overview",       icon: BarChart2 },
  { id: "verifications",  label: "Verifications",  icon: ShieldCheck },
  { id: "paystack",       label: "Paystack",        icon: CreditCard },
  { id: "payouts",        label: "Manager Payouts", icon: Wallet },
  { id: "settings",       label: "Settings",        icon: Settings },
  { id: "users",          label: "Users",           icon: Users },
  { id: "hostels",        label: "Hostels",         icon: Building2 },
  { id: "bookings",       label: "Bookings",        icon: BookOpen },
];

const ROLE_STYLES = {
  student:    "bg-blue-100 text-blue-700",
  manager:    "bg-teal-100 text-teal-700",
  superadmin: "bg-purple-100 text-purple-700",
};

function StatCard({ label, value, sub, icon: Icon, color = "text-brand" }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${color}`}>{value ?? "—"}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        {Icon && <Icon size={22} className={`${color} opacity-70`} />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <ShieldCheck className="text-brand shrink-0" size={28} />
        <h1 className="text-xl sm:text-2xl font-bold">Superadmin Dashboard</h1>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5 border-b border-gray-200 dark:border-gray-700 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors
                ${tab === id
                  ? "border-b-2 border-brand text-brand"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview"       && <OverviewTab />}
      {tab === "verifications"  && <VerificationsTab />}
      {tab === "paystack"       && <PaystackTab />}
      {tab === "payouts"        && <PayoutsTab />}
      {tab === "settings"       && <SettingsTab />}
      {tab === "users"          && <UsersTab />}
      {tab === "hostels"        && <HostelsTab />}
      {tab === "bookings"       && <BookingsTab />}
    </div>
  );
}

// ── Verifications tab ─────────────────────────────────────────────────────────

const VERIF_STATUS = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function VerificationsTab() {
  const { addToast } = useToast();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [rejecting, setRejecting] = useState({}); // id → reason string
  const [busy, setBusy]         = useState({});

  useEffect(() => {
    adminApi.verifications()
      .then(({ data }) => setItems(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  const approve = async (id) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const { data } = await adminApi.approveVerification(id);
      setItems((prev) => prev.map((v) => v.id === id ? data : v));
      addToast("success", "Manager approved — they can now list hostels.");
    } catch {
      addToast("error", "Approval failed.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const reject = async (id) => {
    const reason = rejecting[id] ?? "";
    if (!reason.trim()) { addToast("error", "Enter a rejection reason."); return; }
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const { data } = await adminApi.rejectVerification(id, reason);
      setItems((prev) => prev.map((v) => v.id === id ? data : v));
      setRejecting((r) => { const n = { ...r }; delete n[id]; return n; });
      addToast("info", "Application rejected.");
    } catch {
      addToast("error", "Rejection failed.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <SkeletonBookingRow key={i} />)}</div>;
  if (items.length === 0) return (
    <div className="py-16 text-center text-gray-400">
      <ShieldCheck size={40} className="mx-auto mb-3 opacity-40" />
      <p>No verification submissions yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((v) => {
        const st = VERIF_STATUS[v.status] ?? VERIF_STATUS.pending;
        const isOpen = expanded === v.id;
        const isRejectMode = v.id in rejecting;

        return (
          <div key={v.id} className="card overflow-hidden">
            {/* Header row */}
            <div
              className="flex flex-wrap items-center gap-3 p-4 cursor-pointer hover:bg-gray-50
                dark:hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : v.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{v.manager_username}</p>
                <p className="text-xs text-gray-400">{v.manager_email}</p>
              </div>
              <span className="text-sm text-gray-500">{v.nationality}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>
                {st.label}
              </span>
              {v.payment_confirmed
                ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12}/> Paid</span>
                : <span className="flex items-center gap-1 text-xs text-amber-500"><Clock size={12}/> Unpaid</span>
              }
              <span className="text-xs text-gray-400">{new Date(v.submitted_at).toLocaleDateString()}</span>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                {/* Images */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { url: v.id_front, label: "ID Front" },
                    { url: v.id_back,  label: "ID Back" },
                    { url: v.selfie,   label: "Selfie" },
                  ].map(({ url, label }) => url ? (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                      className="group relative block">
                      <img src={url} alt={label}
                        className="h-24 sm:h-28 w-full rounded-lg object-cover ring-1 ring-gray-200
                          group-hover:ring-brand transition-all dark:ring-gray-700" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5
                        text-xs font-medium text-white flex items-center gap-1">
                        <ExternalLink size={10}/> {label}
                      </span>
                    </a>
                  ) : (
                    <div key={label} className="flex h-24 sm:h-28 items-center justify-center
                      rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-gray-800">
                      No image
                    </div>
                  ))}
                </div>

                {/* Location */}
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Address:</span> {v.address || "—"}</p>
                  {v.latitude && (
                    <p><span className="font-medium">GPS:</span> {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}</p>
                  )}
                </div>

                {/* Rejection reason (if already rejected) */}
                {v.rejection_reason && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600
                    dark:bg-red-900/20 dark:text-red-400">
                    <strong>Rejection reason:</strong> {v.rejection_reason}
                  </p>
                )}

                {/* Action buttons */}
                {v.status === "pending" && (
                  <div className="space-y-3">
                    {isRejectMode ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          className="input resize-none text-sm"
                          placeholder="Reason for rejection (required)"
                          value={rejecting[v.id]}
                          onChange={(e) => setRejecting((r) => ({ ...r, [v.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => reject(v.id)}
                            disabled={busy[v.id]}
                            className="btn-primary bg-red-600 hover:bg-red-700 px-4 py-2 text-sm disabled:opacity-50"
                          >
                            {busy[v.id] ? "Rejecting…" : "Confirm Reject"}
                          </button>
                          <button
                            onClick={() => setRejecting((r) => { const n = { ...r }; delete n[v.id]; return n; })}
                            className="btn-ghost px-4 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(v.id)}
                          disabled={busy[v.id]}
                          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2
                            text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <CheckCircle2 size={14}/> {busy[v.id] ? "Approving…" : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejecting((r) => ({ ...r, [v.id]: "" }))}
                          className="flex items-center gap-1.5 rounded-lg border border-red-300
                            px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition
                            dark:border-red-800 dark:hover:bg-red-900/20"
                        >
                          <XCircle size={14}/> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.overview()
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <SkeletonStatCard key={i}/>)}
      </div>
    </div>
  );

  if (!data) return <p className="text-gray-500">Failed to load overview.</p>;

  const { users, hostels, bookings, revenue, monthly, top_hostels } = data;

  const maxMonthly = Math.max(...(monthly ?? []).map(m => m.revenue ?? 0), 1);

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={`GHS ${(revenue?.total ?? 0).toFixed(2)}`} icon={TrendingUp} color="text-green-600"
          sub={`GHS ${(revenue?.pending_approval ?? 0).toFixed(2)} awaiting approval`} />
        <StatCard label="Total Users" value={users?.total ?? 0} icon={Users} color="text-brand"
          sub={`${users?.new_last_30d ?? 0} new in last 30 days`} />
        <StatCard label="Hostels" value={hostels?.total ?? 0} icon={Building2} color="text-purple-600"
          sub={`${hostels?.active ?? 0} active`} />
        <StatCard label="Bookings" value={bookings?.total ?? 0} icon={BookOpen} color="text-orange-600"
          sub={`${bookings?.awaiting_approval ?? 0} awaiting approval`} />
      </div>

      {/* Booking breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid & Approved" value={bookings?.paid ?? 0} color="text-green-600" />
        <StatCard label="Pending Payment" value={bookings?.pending ?? 0} color="text-yellow-600" />
        <StatCard label="Users: Managers" value={users?.managers ?? 0} icon={UserCheck} color="text-teal-600"
          sub={`${users?.students ?? 0} students`} />
      </div>

      {/* Monthly revenue chart */}
      {monthly?.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-gray-700 dark:text-gray-300">Monthly Revenue (GHS)</h2>
          <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: "120px" }}>
            {monthly.map((m) => {
              const height = Math.round(((m.revenue ?? 0) / maxMonthly) * 100);
              return (
                <div key={m.month} className="flex flex-col items-center gap-1 flex-1 min-w-[40px]">
                  <span className="text-xs text-gray-500">{(m.revenue ?? 0).toFixed(0)}</span>
                  <div
                    className="w-full rounded-t bg-brand/80 transition-all"
                    style={{ height: `${Math.max(height, 4)}px` }}
                  />
                  <span className="text-xs text-gray-400 rotate-45 origin-left whitespace-nowrap">
                    {m.month ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top hostels */}
      {top_hostels?.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 font-semibold text-gray-700 dark:text-gray-300">Top Hostels by Revenue</h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {top_hostels.map((h, i) => (
              <div key={h["hostel__slug"] ?? h.slug ?? i} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{h["hostel__name"] ?? h.name}</p>
                  <p className="text-xs text-gray-400">{h.bookings ?? h.booking_count ?? 0} booking{(h.bookings ?? h.booking_count ?? 0) !== 1 ? "s" : ""}</p>
                </div>
                <p className="font-semibold text-green-600">GHS {(h.revenue ?? 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paystack tab ──────────────────────────────────────────────────────────────

function PaystackTab() {
  const [balance, setBalance] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    adminApi.paystackBalance()
      .then(({ data }) => setBalance(data))
      .catch(() => setBalance({ detail: "Failed to fetch balance." }))
      .finally(() => setLoadingBal(false));
    adminApi.paystackTransfers()
      .then(({ data }) => setTransfers(Array.isArray(data) ? data : (data.data ?? data.transfers ?? [])))
      .catch(() => setTransfers([]))
      .finally(() => setLoadingTx(false));
  }, []);

  // balance is either an array (Paystack configured) or {detail, stub, balances}
  const balanceList = Array.isArray(balance) ? balance : null;
  const balanceMsg = !balanceList ? (balance?.detail ?? "Balance unavailable — check Paystack credentials.") : null;

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-700 dark:text-gray-300">Platform Paystack Balance</h2>
        {loadingBal ? (
          <SkeletonStatCard />
        ) : balanceList ? (
          <div className="flex flex-wrap gap-3">
            {balanceList.map((b, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex-1 min-w-[140px]">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{b.currency}</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {b.currency} {((b.balance ?? 0) / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{balanceMsg}</p>
        )}
      </div>

      {/* Transfer log */}
      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-gray-700 dark:text-gray-300">Transfer Log</h2>
        {loadingTx && <div className="space-y-3">{[1,2,3].map(i => <SkeletonBookingRow key={i}/>)}</div>}
        {!loadingTx && transfers.length === 0 && (
          <p className="text-sm text-gray-500">No transfers recorded yet.</p>
        )}
        {!loadingTx && transfers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase">
                  <th className="pb-2 pr-4">Reference</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transfers.map((t, i) => (
                  <tr key={t.transfer_code ?? t.reference ?? i}>
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {t.transfer_code ?? t.reference ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-medium">
                      {t.currency ?? "GHS"}{" "}
                      {t.amount != null
                        ? t.stub
                          ? Number(t.amount).toFixed(2)          // local record — already in GHS
                          : (t.amount / 100).toFixed(2)          // Paystack — in kobo
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                        ${(t.status === "success" || t.status === "paid") ? "bg-green-100 text-green-700"
                          : t.status === "pending" ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-500"}`}>
                        {t.status ?? "—"}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-400 text-xs">
                      {t.createdAt ?? t.created_at
                        ? new Date(t.createdAt ?? t.created_at).toLocaleDateString("en-GH", { day:"numeric", month:"short", year:"numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manager Payouts tab ───────────────────────────────────────────────────────

function PayoutsTab() {
  const { addToast } = useToast();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    adminApi.managers()
      .then(({ data }) => setManagers(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  const saveCode = async (mgr) => {
    const code = editing[mgr.id] ?? mgr.paystack_recipient_code ?? "";
    setSaving(prev => ({ ...prev, [mgr.id]: true }));
    try {
      const { data } = await adminApi.setRecipient(mgr.id, code);
      setManagers(prev => prev.map(m => m.id === mgr.id ? { ...m, paystack_recipient_code: data.paystack_recipient_code } : m));
      setEditing(prev => { const n = { ...prev }; delete n[mgr.id]; return n; });
      addToast("success", "Recipient code saved.");
    } catch {
      addToast("error", "Could not save recipient code.");
    } finally {
      setSaving(prev => ({ ...prev, [mgr.id]: false }));
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <SkeletonBookingRow key={i}/>)}</div>;
  if (managers.length === 0) return <p className="text-gray-500">No managers found.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Set each manager's Paystack recipient code (MoMo/bank) so payouts can be disbursed after booking approval.
      </p>
      {managers.map((mgr) => {
        const current = editing[mgr.id] ?? mgr.paystack_recipient_code ?? "";
        const isDirty = mgr.id in editing;
        return (
          <div key={mgr.id} className="card p-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{mgr.username}</p>
              <p className="text-sm text-gray-500">{mgr.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 sm:min-w-[220px] sm:max-w-md">
              <input
                type="text"
                placeholder="RCP_xxxxxxxxxxxx"
                className="input flex-1 font-mono text-sm"
                value={current}
                onChange={(e) => setEditing(prev => ({ ...prev, [mgr.id]: e.target.value }))}
              />
              {isDirty && (
                <button
                  onClick={() => saveCode(mgr)}
                  disabled={saving[mgr.id]}
                  className="btn-primary px-3 py-2 text-sm shrink-0">
                  {saving[mgr.id] ? "Saving…" : "Save"}
                </button>
              )}
              {!isDirty && mgr.paystack_recipient_code && (
                <span className="text-xs text-green-600 shrink-0">Saved</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { addToast } = useToast();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.settings()
      .then(({ data }) => {
        setCfg(data);
        setForm({
          PLATFORM_NAME: data.PLATFORM_NAME ?? "",
          PLATFORM_CONTACT_EMAIL: data.PLATFORM_CONTACT_EMAIL ?? "",
          PLATFORM_COMMISSION_RATE: data.PLATFORM_COMMISSION_RATE ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminApi.updateSettings(form);
      setCfg(prev => ({ ...prev, ...data }));
      addToast("success", "Settings saved (in-process). Update Render env vars for permanence.");
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <SkeletonStatCard key={i}/>)}</div>;

  const readOnly = {
    PAYSTACK_CONFIGURED: cfg?.PAYSTACK_CONFIGURED,
    R2_ENABLED: cfg?.R2_ENABLED,
    DEBUG: cfg?.DEBUG,
    ADMIN_USERNAME: cfg?.ADMIN_USERNAME,
    ADMIN_EMAIL: cfg?.ADMIN_EMAIL,
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Editable settings */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Platform Configuration</h2>

        <div>
          <label className="label">Platform Name</label>
          <input className="input" value={form.PLATFORM_NAME} onChange={e => setForm(p => ({ ...p, PLATFORM_NAME: e.target.value }))} />
        </div>
        <div>
          <label className="label">Contact Email</label>
          <input className="input" type="email" value={form.PLATFORM_CONTACT_EMAIL} onChange={e => setForm(p => ({ ...p, PLATFORM_CONTACT_EMAIL: e.target.value }))} />
        </div>
        <div>
          <label className="label">Commission Rate (e.g. 0.10 = 10%)</label>
          <input className="input" type="number" step="0.01" min="0" max="1"
            value={form.PLATFORM_COMMISSION_RATE} onChange={e => setForm(p => ({ ...p, PLATFORM_COMMISSION_RATE: e.target.value }))} />
          <p className="mt-1 text-xs text-gray-400">
            Current: {parseFloat(form.PLATFORM_COMMISSION_RATE || 0) * 100}% platform fee per booking.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary px-4 py-2">
          {saving ? "Saving…" : "Save Settings"}
        </button>
        <p className="text-xs text-gray-400">
          Changes apply immediately in the current process. To persist across restarts, update the Render environment variables.
        </p>
      </div>

      {/* Read-only system info */}
      <div className="card p-6 space-y-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">System Status</h2>
        {Object.entries(readOnly).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-sm font-mono text-gray-500">{k}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium
              ${v === true ? "bg-green-100 text-green-700"
                : v === false ? "bg-gray-100 text-gray-500"
                : "bg-gray-100 text-gray-700"}`}>
              {v === true ? "Yes" : v === false ? "No" : String(v ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.users().then(({ data }) => setUsers(data.results ?? data)).finally(() => setLoading(false));
  }, []);

  const updateUser = async (id, payload) => {
    try {
      const { data } = await adminApi.updateUser(id, payload);
      setUsers((prev) => prev.map((u) => u.id === id ? data : u));
      addToast("success", "User updated.");
    } catch {
      addToast("error", "Could not update user.");
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i=><SkeletonBookingRow key={i}/>)}</div>;
  if (users.length === 0) return <p className="text-gray-500">No users found.</p>;

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className={`card p-4 flex flex-wrap items-start justify-between gap-3
          ${!u.is_active ? "opacity-60" : ""}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold ${!u.is_active ? "line-through text-gray-400" : ""}`}>{u.username}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                {u.role}
              </span>
              {!u.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">Inactive</span>}
            </div>
            <p className="text-sm text-gray-500 break-words">{u.email} {u.university ? `· ${u.university}` : ""}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {u.role !== "superadmin" && (
              <button
                onClick={() => updateUser(u.id, { role: u.role === "manager" ? "student" : "manager" })}
                className="btn-ghost px-3 py-1.5 text-xs min-h-[32px]">
                → {u.role === "manager" ? "Student" : "Manager"}
              </button>
            )}
            <button
              onClick={() => updateUser(u.id, { is_active: !u.is_active })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition min-h-[32px]
                ${u.is_active
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-green-200 text-green-600 hover:bg-green-50"}`}>
              {u.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hostels tab ───────────────────────────────────────────────────────────────

function HostelsTab() {
  const { addToast } = useToast();
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.hostels().then(({ data }) => setHostels(data.results ?? data)).finally(() => setLoading(false));
  }, []);

  const toggle = async (hostel) => {
    try {
      const fn = hostel.is_active ? adminApi.deactivateHostel : adminApi.activateHostel;
      const { data } = await fn(hostel.slug);
      setHostels((prev) => prev.map((h) => h.slug === hostel.slug ? data : h));
      addToast("success", hostel.is_active ? "Hostel deactivated." : "Hostel activated.");
    } catch {
      addToast("error", "Could not update hostel.");
    }
  };

  const verify = async (hostel) => {
    try {
      const { data } = await adminApi.verifyHostel(hostel.slug);
      setHostels((prev) => prev.map((h) => h.slug === hostel.slug ? data : h));
      addToast("success", data.is_verified ? "Hostel verified." : "Verification removed.");
    } catch {
      addToast("error", "Could not update verification.");
    }
  };

  if (loading) return <div className="grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if (hostels.length === 0) return <p className="text-gray-500">No hostels found.</p>;

  return (
    <div className="space-y-2">
      {hostels.map((h) => (
        <div key={h.slug} className={`card p-4 flex flex-wrap items-start justify-between gap-3
          ${!h.is_active ? "opacity-60" : ""}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{h.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                ${h.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                {h.is_active ? "Active" : "Inactive"}
              </span>
              {h.is_verified && (
                <span className="flex items-center gap-0.5 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  <BadgeCheck size={11}/> Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {h.campus_display} · {h.location} · Owner: {h.owner_username}
            </p>
            <p className="text-xs text-gray-400">
              {h.booking_count} booking{h.booking_count !== 1 ? "s" : ""} · GHS {h.base_price}/bed
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => verify(h)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${h.is_verified
                  ? "border-gray-200 text-gray-500 hover:bg-gray-50"
                  : "border-brand/30 text-brand hover:bg-brand/5"}`}>
              {h.is_verified ? "Unverify" : "Verify"}
            </button>
            <button
              onClick={() => toggle(h)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition
                ${h.is_active
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-green-200 text-green-600 hover:bg-green-50"}`}>
              {h.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback((paymentStatus) => {
    setLoading(true);
    adminApi.bookings(paymentStatus ? { payment_status: paymentStatus } : {})
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(statusFilter); }, [statusFilter, load]);

  const approve = async (id) => {
    try {
      const { data } = await adminApi.approveBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? data.booking : b));
      addToast("success", `Booking approved. Payout: GHS ${data.payout?.payout ?? "—"}`);
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not approve booking.");
    }
  };

  const refund = async (id) => {
    try {
      const { data } = await adminApi.refundBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? data : b));
      addToast("success", "Booking marked as refunded.");
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not refund booking.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label className="label mb-0 sm:whitespace-nowrap shrink-0">Filter by status:</label>
        <select className="input w-full sm:max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          {Object.entries(STATUS_UI).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading && <div className="space-y-3">{[1,2,3].map(i=><SkeletonBookingRow key={i}/>)}</div>}
      {!loading && bookings.length === 0 && <p className="text-gray-500">No bookings found.</p>}

      <div className="space-y-2">
        {bookings.map((b) => {
          const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
          const Icon = ui.icon;
          return (
            <div key={b.id} className="card p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold flex flex-wrap gap-1 items-baseline">
                  <span className="truncate">{b.student_username ?? `Student #${b.student}`}</span>
                  <span className="text-sm font-normal text-gray-500">→ {b.hostel_name}</span>
                </p>
                <p className="text-sm text-gray-500 break-words">
                  {b.room_type} · GHS {b.amount} · #{b.id}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(b.created_at).toLocaleDateString("en-GH", { day:"numeric", month:"short", year:"numeric" })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${ui.cls}`}>
                  <Icon size={16}/> {ui.label}
                </span>
                {b.payment_status === "paid_awaiting_approval" && (
                  <button
                    onClick={() => approve(b.id)}
                    className="rounded-lg border border-green-300 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50">
                    Approve & Pay Out
                  </button>
                )}
                {b.payment_status === "paid" && (
                  <button
                    onClick={() => refund(b.id)}
                    className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                    Refund
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
