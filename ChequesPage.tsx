import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Clock,
  Search, Bell, BellRing, X, Eye, Edit2,
  Banknote, Calendar, Building2, User, Hash, RefreshCw,
} from "lucide-react";

interface ChequesPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

type ChequeStatus = "pending" | "confirmed" | "cancelled" | "bounced";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

const STATUS_CONFIG: Record<ChequeStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-100",   icon: Clock },
  confirmed: { label: "Confirmed", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "text-slate-600",   bg: "bg-slate-100",   icon: XCircle },
  bounced:   { label: "Bounced",   color: "text-red-700",     bg: "bg-red-100",     icon: AlertTriangle },
};

export default function ChequesPage({ selectedStoreId }: ChequesPageProps) {
  const [filterStatus, setFilterStatus] = useState<"" | ChequeStatus>("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "notifications">("all");
  const [viewCheque, setViewCheque] = useState<any | null>(null);
  const [editCheque, setEditCheque] = useState<any | null>(null);

  const stats = useQuery(api.cheques.getStats, { storeId: selectedStoreId ?? undefined });
  const rawCheques = useQuery(api.cheques.list, {
    storeId: selectedStoreId ?? undefined,
    status: filterStatus || undefined,
  });
  const searchResults = useQuery(
    api.cheques.search,
    searchText.trim().length >= 2 ? { searchText: searchText.trim() } : "skip"
  );
  const dueSoon = useQuery(api.cheques.getDueSoon, { storeId: selectedStoreId ?? undefined, daysAhead: 7 });
  const overdue = useQuery(api.cheques.getOverdue, { storeId: selectedStoreId ?? undefined });

  const updateStatus = useMutation(api.cheques.updateStatus);
  const updateCheque = useMutation(api.cheques.update);

  const cheques = searchText.trim().length >= 2 ? (searchResults ?? []) : (rawCheques ?? []);

  const handleStatusChange = async (chequeId: Id<"cheques">, status: ChequeStatus, notes?: string) => {
    try {
      await updateStatus({ chequeId, status, notes });
      toast.success(`Cheque marked as ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const notifCount = (overdue?.length ?? 0) + (dueSoon?.length ?? 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cheque Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track, confirm, and monitor all cheque payments</p>
        </div>
        {notifCount > 0 && (
          <button
            onClick={() => setActiveTab("notifications")}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium text-sm hover:bg-red-100 transition-colors"
          >
            <BellRing className="w-4 h-4 animate-pulse" />
            {notifCount} Alert{notifCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pending",   value: stats?.pending ?? 0,   amount: stats?.pendingAmount ?? 0,   color: "bg-amber-50 border-amber-200",    text: "text-amber-700",   icon: Clock },
          { label: "Confirmed", value: stats?.confirmed ?? 0, amount: stats?.confirmedAmount ?? 0, color: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: CheckCircle },
          { label: "Overdue",   value: stats?.overdue ?? 0,   amount: stats?.overdueAmount ?? 0,   color: "bg-red-50 border-red-200",         text: "text-red-700",     icon: AlertTriangle },
          { label: "Due in 7d", value: stats?.dueSoon ?? 0,   amount: 0,                           color: "bg-blue-50 border-blue-200",       text: "text-blue-700",    icon: Bell },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${s.text}`} />
                <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              {s.amount > 0 && (
                <p className={`text-xs mt-0.5 ${s.text} opacity-70`}>ج.م{fmt(s.amount)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
        {(["all", "notifications"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "notifications" && notifCount > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {notifCount}
              </span>
            )}
            {tab === "all" ? "All Cheques" : "Notifications"}
          </button>
        ))}
      </div>

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          {(overdue ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-700 text-sm">Overdue Cheques ({overdue!.length})</span>
              </div>
              <div className="divide-y divide-slate-100">
                {overdue!.map((c) => (
                  <NotifRow key={c._id} cheque={c} type="overdue" onAction={handleStatusChange} onView={setViewCheque} />
                ))}
              </div>
            </div>
          )}
          {(dueSoon ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-amber-700 text-sm">Due Within 7 Days ({dueSoon!.length})</span>
              </div>
              <div className="divide-y divide-slate-100">
                {dueSoon!.map((c) => (
                  <NotifRow key={c._id} cheque={c} type="due-soon" onAction={handleStatusChange} onView={setViewCheque} />
                ))}
              </div>
            </div>
          )}
          {notifCount === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">All Clear!</h3>
              <p className="text-slate-400 text-sm">No overdue or upcoming cheques to worry about.</p>
            </div>
          )}
        </div>
      )}

      {/* All Cheques Tab */}
      {activeTab === "all" && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by cheque number..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 outline-none bg-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cheque #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Holder / Bank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Sale</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cheques.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>No cheques found</p>
                      </td>
                    </tr>
                  ) : (
                    cheques.map((cheque) => {
                      const days = daysUntil(cheque.dueDate);
                      const cfg = STATUS_CONFIG[cheque.status as ChequeStatus] ?? STATUS_CONFIG.pending;
                      const StatusIcon = cfg.icon;
                      const isOverdue = cheque.status === "pending" && days < 0;
                      const isDueSoon = cheque.status === "pending" && days >= 0 && days <= 7;
                      return (
                        <tr key={cheque._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Hash className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono font-semibold text-slate-800">{cheque.chequeNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{cheque.chequeHolderName}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />{cheque.bankName}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {cheque.saleNumber ? (
                              <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                                {cheque.saleNumber}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                            {cheque.customerName && (
                              <p className="text-xs text-slate-400 mt-0.5">{cheque.customerName}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900">ج.م{fmt(cheque.amount)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700">{fmtDate(cheque.dueDate)}</p>
                            {isOverdue && (
                              <span className="text-xs text-red-600 font-semibold">{Math.abs(days)}d overdue</span>
                            )}
                            {isDueSoon && (
                              <span className="text-xs text-amber-600 font-semibold">
                                {days === 0 ? "Due today!" : `${days}d left`}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setViewCheque(cheque)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditCheque(cheque)} className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {cheque.status === "pending" && (
                                <>
                                  <button onClick={() => handleStatusChange(cheque._id, "confirmed")} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Confirm">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleStatusChange(cheque._id, "bounced")} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Bounced">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleStatusChange(cheque._id, "cancelled")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Cancel">
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewCheque && (
        <ChequeDetailModal cheque={viewCheque} onClose={() => setViewCheque(null)} onStatusChange={handleStatusChange} />
      )}
      {editCheque && (
        <EditChequeModal
          cheque={editCheque}
          onSave={async (data) => {
            try {
              await updateCheque({ chequeId: editCheque._id, ...data });
              toast.success("Cheque updated");
              setEditCheque(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to update");
            }
          }}
          onClose={() => setEditCheque(null)}
        />
      )}
    </div>
  );
}

// ── Notification Row ──────────────────────────────────────────────────────────

function NotifRow({ cheque, type, onAction, onView }: {
  cheque: any;
  type: "overdue" | "due-soon";
  onAction: (id: Id<"cheques">, status: ChequeStatus, notes?: string) => void;
  onView: (c: any) => void;
}) {
  const days = daysUntil(cheque.dueDate);
  return (
    <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${type === "overdue" ? "bg-red-100" : "bg-amber-100"}`}>
          {type === "overdue"
            ? <AlertTriangle className="w-5 h-5 text-red-600" />
            : <Bell className="w-5 h-5 text-amber-600" />
          }
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 font-mono">#{cheque.chequeNumber}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">{cheque.chequeHolderName}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 text-sm">{cheque.bankName}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="font-bold text-slate-900">ج.م{fmt(cheque.amount)}</span>
            <span className={`text-xs font-semibold ${type === "overdue" ? "text-red-600" : "text-amber-600"}`}>
              {type === "overdue"
                ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} overdue`
                : days === 0 ? "Due TODAY" : `Due in ${days} day${days !== 1 ? "s" : ""}`}
            </span>
            <span className="text-xs text-slate-400">{fmtDate(cheque.dueDate)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onView(cheque)} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">View</button>
        <button onClick={() => onAction(cheque._id, "confirmed")} className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors">Confirm</button>
        <button onClick={() => onAction(cheque._id, "bounced")} className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">Bounced</button>
      </div>
    </div>
  );
}

// ── Cheque Detail Modal ───────────────────────────────────────────────────────

function ChequeDetailModal({ cheque, onClose, onStatusChange }: {
  cheque: any;
  onClose: () => void;
  onStatusChange: (id: Id<"cheques">, status: ChequeStatus, notes?: string) => void;
}) {
  const [notes, setNotes] = useState(cheque.notes ?? "");
  const cfg = STATUS_CONFIG[cheque.status as ChequeStatus] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const days = daysUntil(cheque.dueDate);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cheque Details</h2>
              <p className="text-xs text-slate-400 font-mono">#{cheque.chequeNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${cfg.bg}`}>
            <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
            <div>
              <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
              {cheque.status === "pending" && (
                <p className={`text-xs mt-0.5 ${days < 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-slate-500"}`}>
                  {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today!" : `Due in ${days} days`}
                </p>
              )}
              {cheque.confirmedAt && (
                <p className="text-xs text-slate-500 mt-0.5">Confirmed on {new Date(cheque.confirmedAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Hash,      label: "Cheque Number", value: cheque.chequeNumber },
              { icon: Building2, label: "Bank",          value: cheque.bankName },
              { icon: User,      label: "Cheque Holder", value: cheque.chequeHolderName },
              { icon: Banknote,  label: "Amount",        value: `ج.م${fmt(cheque.amount)}` },
              { icon: Calendar,  label: "Due Date",      value: fmtDate(cheque.dueDate) },
              { icon: FileText,  label: "Linked Sale",   value: cheque.saleNumber ?? "—" },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs text-slate-400 font-medium">{row.label}</p>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{row.value}</p>
                </div>
              );
            })}
          </div>

          {/* Customer */}
          {(cheque.customerName || cheque.customerPhone) && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs text-blue-500 font-medium mb-1">Customer</p>
              {cheque.customerName && <p className="font-semibold text-blue-800">{cheque.customerName}</p>}
              {cheque.customerPhone && <p className="text-sm text-blue-600">{cheque.customerPhone}</p>}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 outline-none resize-none"
              placeholder="Add notes..."
            />
          </div>

          {/* Action Buttons */}
          {cheque.status === "pending" && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { onStatusChange(cheque._id, "confirmed", notes || undefined); onClose(); }}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Confirm
              </button>
              <button
                onClick={() => { onStatusChange(cheque._id, "bounced", notes || undefined); onClose(); }}
                className="py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4" /> Bounced
              </button>
              <button
                onClick={() => { onStatusChange(cheque._id, "cancelled", notes || undefined); onClose(); }}
                className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            </div>
          )}
          {cheque.status !== "pending" && (
            <button
              onClick={() => { onStatusChange(cheque._id, "pending", notes || undefined); onClose(); }}
              className="w-full py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Reset to Pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Cheque Modal ─────────────────────────────────────────────────────────

function EditChequeModal({ cheque, onSave, onClose }: {
  cheque: any;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    chequeNumber:     cheque.chequeNumber     ?? "",
    bankName:         cheque.bankName         ?? "",
    chequeHolderName: cheque.chequeHolderName ?? "",
    dueDate:          cheque.dueDate          ?? "",
    notes:            cheque.notes            ?? "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chequeNumber.trim())     { toast.error("Cheque number is required"); return; }
    if (!form.bankName.trim())         { toast.error("Bank name is required"); return; }
    if (!form.chequeHolderName.trim()) { toast.error("Cheque holder name is required"); return; }
    if (!form.dueDate)                 { toast.error("Due date is required"); return; }
    setLoading(true);
    await onSave(form);
    setLoading(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Edit Cheque</h2>
              <p className="text-xs text-slate-400 font-mono">#{cheque.chequeNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Read-only info strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-0.5 flex items-center gap-1">
                <Banknote className="w-3 h-3" /> Amount
              </p>
              <p className="font-bold text-slate-900">ج.م{fmt(cheque.amount)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-0.5 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Linked Sale
              </p>
              <p className="font-semibold text-blue-700 font-mono text-sm">{cheque.saleNumber ?? "—"}</p>
            </div>
            {cheque.customerName && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 col-span-2">
                <p className="text-xs text-blue-400 font-medium mb-0.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> Customer
                </p>
                <p className="font-semibold text-blue-800">{cheque.customerName}</p>
                {cheque.customerPhone && <p className="text-xs text-blue-600 mt-0.5">{cheque.customerPhone}</p>}
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            {/* Cheque Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-slate-400" /> Cheque Number *</span>
              </label>
              <input
                type="text"
                value={form.chequeNumber}
                onChange={set("chequeNumber")}
                placeholder="e.g. 123456"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> Bank Name *</span>
              </label>
              <input
                type="text"
                value={form.bankName}
                onChange={set("bankName")}
                placeholder="e.g. CIB, NBE, Banque Misr"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Cheque Holder Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> Cheque Holder Name *</span>
              </label>
              <input
                type="text"
                value={form.chequeHolderName}
                onChange={set("chequeHolderName")}
                placeholder="Full name as written on cheque"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Due Date *</span>
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={set("dueDate")}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
              {form.dueDate && (() => {
                const d = Math.round((new Date(form.dueDate + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                return (
                  <p className={`text-xs mt-1 font-medium ${d < 0 ? "text-red-500" : d <= 7 ? "text-amber-500" : "text-slate-400"}`}>
                    {d < 0 ? `${Math.abs(d)} days overdue` : d === 0 ? "Due today!" : `Due in ${d} days`}
                  </p>
                );
              })()}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Optional notes about this cheque..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}