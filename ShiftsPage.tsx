import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Clock,
  DollarSign,
  TrendingUp,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  AlertTriangle,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  FileText,
  RefreshCw,
} from "lucide-react";

interface ShiftsPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ShiftsPage({ selectedStoreId, stores, isManager }: ShiftsPageProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDetailId, setShowDetailId] = useState<Id<"shifts"> | null>(null);
  const [expandedShift, setExpandedShift] = useState<Id<"shifts"> | null>(null);

  // Use first store if none selected
  const effectiveStoreId = selectedStoreId ?? stores[0]?._id ?? null;
  const effectiveStore = stores.find((s) => s._id === effectiveStoreId);

  const activeShift = useQuery(
    api.shifts.getActiveShift,
    effectiveStoreId ? { storeId: effectiveStoreId } : "skip"
  );
  const shiftHistory = useQuery(
    api.shifts.list,
    effectiveStoreId ? { storeId: effectiveStoreId, limit: 30 } : "skip"
  );
  const shiftDetail = useQuery(
    api.shifts.getShiftDetail,
    showDetailId ? { shiftId: showDetailId } : "skip"
  );

  const openShift = useMutation(api.shifts.open);
  const closeShift = useMutation(api.shifts.close);
  const addEvent = useMutation(api.shifts.addEvent);

  if (!effectiveStoreId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No store selected</p>
          <p className="text-slate-400 text-sm mt-1">Please select a store to manage shifts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shift Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Cash drawer & daily reconciliation — {effectiveStore?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeShift && (
            <>
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cash In / Out
              </button>
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Lock className="w-4 h-4" />
                Close Shift
              </button>
            </>
          )}
          {!activeShift && activeShift !== undefined && (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              Open Shift
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        {(["current", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "current" ? "Current Shift" : "Shift History"}
          </button>
        ))}
      </div>

      {/* Current Shift Tab */}
      {activeTab === "current" && (
        <>
          {activeShift === undefined && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
                  <div className="h-8 bg-slate-200 rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {activeShift === null && (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Open Shift</h3>
              <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                Open a shift to start tracking cash sales, drawer movements, and end-of-day reconciliation.
              </p>
              <button
                onClick={() => setShowOpenModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                <Unlock className="w-5 h-5" />
                Open Shift Now
              </button>
            </div>
          )}

          {activeShift && (
            <ActiveShiftView
              shift={activeShift}
              onAddEvent={() => setShowEventModal(true)}
              onClose={() => setShowCloseModal(true)}
            />
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <ShiftHistoryView
          shifts={shiftHistory ?? []}
          expandedShift={expandedShift}
          setExpandedShift={setExpandedShift}
          onViewDetail={(id) => setShowDetailId(id)}
        />
      )}

      {/* Modals */}
      {showOpenModal && effectiveStoreId && (
        <OpenShiftModal
          storeId={effectiveStoreId}
          onOpen={openShift}
          onClose={() => setShowOpenModal(false)}
        />
      )}

      {showCloseModal && activeShift && (
        <CloseShiftModal
          shift={activeShift}
          onClose={closeShift}
          onCancel={() => setShowCloseModal(false)}
        />
      )}

      {showEventModal && activeShift && effectiveStoreId && (
        <AddEventModal
          shiftId={activeShift._id}
          storeId={effectiveStoreId}
          onAdd={addEvent}
          onClose={() => setShowEventModal(false)}
        />
      )}

      {showDetailId && shiftDetail && (
        <ShiftDetailModal
          shift={shiftDetail}
          onClose={() => setShowDetailId(null)}
        />
      )}
    </div>
  );
}

// ─── Active Shift View ────────────────────────────────────────────────────────

function ActiveShiftView({
  shift,
  onAddEvent,
  onClose,
}: {
  shift: any;
  onAddEvent: () => void;
  onClose: () => void;
}) {
  const duration = Date.now() - shift.openedAt;
  const cashIn = shift.cashIn ?? 0;
  const cashOut = shift.cashOut ?? 0;

  // Live sales query for this shift
  const sales = useQuery(api.sales.list, {
    storeId: shift.storeId,
    status: "completed",
  });

  const shiftSales = (sales ?? []).filter(
    (s) => s._creationTime >= shift.openedAt
  );
  const cashSales = shiftSales
    .filter((s) => s.paymentType === "cash")
    .reduce((sum, s) => sum + s.total, 0);
  const creditSales = shiftSales
    .filter((s) => s.paymentType === "credit")
    .reduce((sum, s) => sum + s.total, 0);
  const phoneTransferSales = shiftSales
    .filter((s) => s.paymentType === "phone_transfer")
    .reduce((sum, s) => sum + s.total, 0);
  const chequeSales = shiftSales
    .filter((s) => s.paymentType === "cheque")
    .reduce((sum, s) => sum + s.total, 0);
  const totalSales = cashSales + creditSales + phoneTransferSales + chequeSales;
  const expectedCash = shift.openingFloat + cashSales + cashIn - cashOut;

  const stats = [
    {
      label: "Opening Float",
      value: `ج.م${fmt(shift.openingFloat)}`,
      icon: DollarSign,
      bg: "bg-blue-50",
      color: "text-blue-600",
      iconBg: "bg-blue-100",
    },
    {
      label: "Cash Sales",
      value: `ج.م${fmt(cashSales)}`,
      icon: DollarSign,
      bg: "bg-emerald-50",
      color: "text-emerald-600",
      iconBg: "bg-emerald-100",
    },
    {
      label: "Credit Sales",
      value: `ج.م${fmt(creditSales)}`,
      icon: CreditCard,
      bg: "bg-purple-50",
      color: "text-purple-600",
      iconBg: "bg-purple-100",
    },
    {
      label: "Total Sales",
      value: `ج.م${fmt(totalSales)}`,
      icon: TrendingUp,
      bg: "bg-amber-50",
      color: "text-amber-600",
      iconBg: "bg-amber-100",
    },
    {
      label: "Cash In",
      value: `+ج.م${fmt(cashIn)}`,
      icon: ArrowDownCircle,
      bg: "bg-teal-50",
      color: "text-teal-600",
      iconBg: "bg-teal-100",
    },
    {
      label: "Cash Out",
      value: `-ج.م${fmt(cashOut)}`,
      icon: ArrowUpCircle,
      bg: "bg-rose-50",
      color: "text-rose-600",
      iconBg: "bg-rose-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <div>
              <p className="font-semibold text-lg">Shift Open</p>
              <p className="text-emerald-100 text-sm">
                Opened by {shift.openerName} at {fmtTime(shift.openedAt)} · Running {fmtDuration(duration)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-sm">Expected in Drawer</p>
            <p className="text-2xl font-bold">${fmt(expectedCash)}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 ${s.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Transactions + Events side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Transactions This Shift</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
              {shiftSales.length} sales
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {shiftSales.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No sales yet this shift</div>
            ) : (
              shiftSales.slice(0, 20).map((sale) => (
                <div key={sale._id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {sale.customerName ?? "Walk-in"}
                    </p>
                    <p className="text-xs text-slate-400">{fmtTime(sale._creationTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">${fmt(sale.total)}</p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        sale.paymentType === "cash" ? "bg-emerald-100 text-emerald-700" :
                        sale.paymentType === "credit" ? "bg-amber-100 text-amber-700" :
                        sale.paymentType === "phone_transfer" ? "bg-blue-100 text-blue-700" :
                        sale.paymentType === "cheque" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {{ cash: "Cash", credit: "Credit", phone_transfer: "Transfer", cheque: "Cheque" }[sale.paymentType as string] ?? sale.paymentType}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cash Events */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Cash Drawer Events</h3>
            <button
              onClick={onAddEvent}
              className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {(shift.events ?? []).length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">No cash events recorded</div>
            ) : (
              (shift.events ?? []).map((ev: any) => (
                <div key={ev._id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        ev.type === "cash_in"
                          ? "bg-emerald-100"
                          : ev.type === "cash_out"
                          ? "bg-rose-100"
                          : "bg-slate-100"
                      }`}
                    >
                      {ev.type === "cash_in" ? (
                        <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                      ) : ev.type === "cash_out" ? (
                        <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{ev.reason}</p>
                      <p className="text-xs text-slate-400">{fmtTime(ev._creationTime)}</p>
                    </div>
                  </div>
                  {ev.amount != null && (
                    <p
                      className={`text-sm font-bold ${
                        ev.type === "cash_in" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {ev.type === "cash_in" ? "+" : "-"}${fmt(ev.amount)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shift History View ───────────────────────────────────────────────────────

function ShiftHistoryView({
  shifts,
  expandedShift,
  setExpandedShift,
  onViewDetail,
}: {
  shifts: any[];
  expandedShift: Id<"shifts"> | null;
  setExpandedShift: (id: Id<"shifts"> | null) => void;
  onViewDetail: (id: Id<"shifts">) => void;
}) {
  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No shift history yet</p>
        <p className="text-slate-400 text-sm mt-1">Closed shifts will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Shift History</h3>
        <p className="text-xs text-slate-400 mt-0.5">{shifts.length} shifts recorded</p>
      </div>
      <div className="divide-y divide-slate-100">
        {shifts.map((shift) => {
          const isOpen = shift.status === "open";
          const isExpanded = expandedShift === shift._id;
          const duration =
            shift.closedAt
              ? shift.closedAt - shift.openedAt
              : Date.now() - shift.openedAt;
          const variance = shift.cashVariance ?? 0;

          return (
            <div key={shift._id}>
              <div
                className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() =>
                  setExpandedShift(isExpanded ? null : shift._id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isOpen ? "bg-emerald-100" : "bg-slate-100"
                      }`}
                    >
                      {isOpen ? (
                        <Unlock className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800">
                          {fmtDate(shift.openedAt)}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isOpen
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOpen ? "Open" : "Closed"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtTime(shift.openedAt)}
                        {shift.closedAt ? ` → ${fmtTime(shift.closedAt)}` : ""} ·{" "}
                        {fmtDuration(duration)} · {shift.openerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400">Total Sales</p>
                      <p className="font-bold text-slate-800">
                        ${fmt(shift.totalSales ?? 0)}
                      </p>
                    </div>
                    {!isOpen && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Variance</p>
                        <p
                          className={`font-bold ${
                            Math.abs(variance) < 0.01
                              ? "text-emerald-600"
                              : variance > 0
                              ? "text-blue-600"
                              : "text-red-600"
                          }`}
                        >
                          {variance >= 0 ? "+" : ""}${fmt(variance)}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetail(shift._id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View details"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded row */}
              {isExpanded && (
                <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {[
                      { label: "Opening Float", value: `ج.م${fmt(shift.openingFloat)}` },
                      { label: "Closing Float", value: shift.closingFloat != null ? `ج.م${fmt(shift.closingFloat)}` : "—" },
                      { label: "Cash Sales", value: `ج.م${fmt(shift.totalCashSales ?? 0)}` },
                      { label: "Card/Other Sales", value: `ج.م${fmt((shift.totalCreditSales ?? 0))}` },
                      { label: "Transactions", value: String(shift.totalTransactions ?? 0) },
                      { label: "Refunds", value: `ج.م${fmt(shift.totalRefunds ?? 0)}` },
                      { label: "Expected Cash", value: shift.expectedCash != null ? `ج.م${fmt(shift.expectedCash)}` : "—" },
                      {
                        label: "Variance",
                        value:
                          shift.cashVariance != null
                            ? `${shift.cashVariance >= 0 ? "+" : ""}$${fmt(shift.cashVariance)}`
                            : "—",
                      },
                    ].map((item) => (
                      <div key={item.label} className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                        <p className="font-semibold text-slate-800 text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {shift.closingNotes && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-slate-200">
                      <p className="text-xs text-slate-400 mb-1">Closing Notes</p>
                      <p className="text-sm text-slate-700">{shift.closingNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Open Shift Modal ─────────────────────────────────────────────────────────

function OpenShiftModal({
  storeId,
  onOpen,
  onClose,
}: {
  storeId: Id<"stores">;
  onOpen: any;
  onClose: () => void;
}) {
  const [float, setFloat] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const floatVal = parseFloat(float);
    if (isNaN(floatVal) || floatVal < 0) {
      toast.error("Please enter a valid opening float amount");
      return;
    }
    setLoading(true);
    try {
      await onOpen({ storeId, openingFloat: floatVal, notes: notes || undefined });
      toast.success("Shift opened successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open shift");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Unlock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Open Shift</h2>
              <p className="text-xs text-slate-400">Count your opening cash float</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Opening Float (Cash in Drawer)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-lg font-semibold transition-colors"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Count all bills and coins in the drawer before opening
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-colors text-sm"
              placeholder="Any notes for this shift..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
              Open Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Close Shift Modal ────────────────────────────────────────────────────────

function CloseShiftModal({
  shift,
  onClose,
  onCancel,
}: {
  shift: any;
  onClose: any;
  onCancel: () => void;
}) {
  const [closingFloat, setClosingFloat] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Live sales for variance preview
  const sales = useQuery(api.sales.list, {
    storeId: shift.storeId,
    status: "completed",
  });
  const shiftSales = (sales ?? []).filter((s) => s._creationTime >= shift.openedAt);
  const cashSales = shiftSales
    .filter((s) => s.paymentType === "cash")
    .reduce((sum, s) => sum + s.total, 0);
  const cashIn = shift.cashIn ?? 0;
  const cashOut = shift.cashOut ?? 0;
  const expectedCash = shift.openingFloat + cashSales + cashIn - cashOut;
  // Note: phone_transfer and cheque don't affect physical cash drawer
  const closingVal = parseFloat(closingFloat) || 0;
  const variance = closingVal - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    const floatVal = parseFloat(closingFloat);
    if (isNaN(floatVal) || floatVal < 0) {
      toast.error("Please enter a valid closing float amount");
      return;
    }
    setLoading(true);
    try {
      await onClose({
        shiftId: shift._id,
        closingFloat: floatVal,
        closingNotes: notes || undefined,
      });
      toast.success("Shift closed and reconciled");
      onCancel();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close shift");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Close Shift</h2>
              <p className="text-xs text-slate-400">Count your drawer and reconcile</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Shift Summary
            </p>
            {[
              { label: "Opening Float", value: `$${fmt(shift.openingFloat)}` },
              { label: "Cash Sales", value: `+$${fmt(cashSales)}` },
              { label: "Cash In", value: `+$${fmt(cashIn)}` },
              { label: "Cash Out", value: `-$${fmt(cashOut)}` },
              { label: "Expected in Drawer", value: `$${fmt(expectedCash)}`, bold: true },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className={row.bold ? "font-semibold text-slate-800" : "text-slate-500"}>
                  {row.label}
                </span>
                <span className={row.bold ? "font-bold text-slate-900" : "text-slate-700"}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Closing Float */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Actual Cash in Drawer
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={closingFloat}
                onChange={(e) => { setClosingFloat(e.target.value); setConfirmed(false); }}
                className="w-full pl-8 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-lg font-semibold transition-colors"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Variance Preview */}
          {closingVal > 0 && (
            <div
              className={`rounded-xl p-4 flex items-center gap-3 ${
                Math.abs(variance) < 0.01
                  ? "bg-emerald-50 border border-emerald-200"
                  : variance > 0
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {Math.abs(variance) < 0.01 ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              )}
              <div>
                <p
                  className={`font-semibold text-sm ${
                    Math.abs(variance) < 0.01
                      ? "text-emerald-700"
                      : variance > 0
                      ? "text-blue-700"
                      : "text-red-700"
                  }`}
                >
                  {Math.abs(variance) < 0.01
                    ? "Drawer balanced perfectly"
                    : variance > 0
                    ? `Drawer over by $${fmt(Math.abs(variance))}`
                    : `Drawer short by $${fmt(Math.abs(variance))}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expected ${fmt(expectedCash)} · Counted ${fmt(closingVal)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Closing Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-colors text-sm"
              placeholder="Any notes about discrepancies or handover..."
            />
          </div>

          {confirmed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 font-medium">
              Are you sure? This will close the shift and lock the reconciliation. Click again to confirm.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                confirmed ? "bg-red-600 hover:bg-red-700" : "bg-slate-700 hover:bg-slate-800"
              }`}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {confirmed ? "Confirm Close Shift" : "Close Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({
  shiftId,
  storeId,
  onAdd,
  onClose,
}: {
  shiftId: Id<"shifts">;
  storeId: Id<"stores">;
  onAdd: any;
  onClose: () => void;
}) {
  const [type, setType] = useState<"cash_in" | "cash_out" | "note">("cash_in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    if (type !== "note" && (!amount || parseFloat(amount) <= 0)) {
      toast.error("Please enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      await onAdd({
        shiftId,
        storeId,
        type,
        amount: type !== "note" ? parseFloat(amount) : undefined,
        reason: reason.trim(),
      });
      toast.success("Event recorded");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record event");
    } finally {
      setLoading(false);
    }
  };

  const presets = {
    cash_in: ["Change fund", "Bank deposit return", "Petty cash return"],
    cash_out: ["Petty cash", "Bank deposit", "Expense payment", "Supplier payment"],
    note: ["Shift handover", "Drawer check", "Manager note"],
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Cash Drawer Event</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {(["cash_in", "cash_out", "note"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-all border-2 ${
                  type === t
                    ? t === "cash_in"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : t === "cash_out"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {t === "cash_in" ? "Cash In" : t === "cash_out" ? "Cash Out" : "Note"}
              </button>
            ))}
          </div>

          {type !== "note" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-lg font-semibold transition-colors"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-colors text-sm"
              placeholder="Enter reason..."
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets[type].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shift Detail Modal ───────────────────────────────────────────────────────

function ShiftDetailModal({ shift, onClose }: { shift: any; onClose: () => void }) {
  const variance = shift.cashVariance ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Shift Report</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {shift.storeName} · {fmtDate(shift.openedAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div
            className={`rounded-xl p-4 flex items-center gap-3 ${
              shift.status === "open"
                ? "bg-emerald-50 border border-emerald-200"
                : Math.abs(variance) < 0.01
                ? "bg-emerald-50 border border-emerald-200"
                : variance > 0
                ? "bg-blue-50 border border-blue-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {shift.status === "open" ? (
              <Unlock className="w-5 h-5 text-emerald-600" />
            ) : Math.abs(variance) < 0.01 ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            <div>
              <p className="font-semibold text-sm text-slate-800">
                {shift.status === "open"
                  ? "Shift Currently Open"
                  : Math.abs(variance) < 0.01
                  ? "Balanced — No Discrepancy"
                  : variance > 0
                  ? `Over by $${fmt(Math.abs(variance))}`
                  : `Short by $${fmt(Math.abs(variance))}`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Opened by {shift.openerName} at {fmtTime(shift.openedAt)}
                {shift.closedAt ? ` · Closed by ${shift.closerName} at ${fmtTime(shift.closedAt)}` : ""}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Financial Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Opening Float", value: `ج.م${fmt(shift.openingFloat)}`, color: "text-slate-800" },
                { label: "Closing Float", value: shift.closingFloat != null ? `ج.م${fmt(shift.closingFloat)}` : "—", color: "text-slate-800" },
                { label: "Cash Sales", value: `ج.م${fmt(shift.totalCashSales ?? 0)}`, color: "text-emerald-700" },
                { label: "Credit Card Sales", value: `ج.م${fmt(shift.totalCreditSales ?? 0)}`, color: "text-amber-700" },
                { label: "Total Sales", value: `ج.م${fmt(shift.totalSales ?? 0)}`, color: "text-blue-700" },
                { label: "Transactions", value: String(shift.totalTransactions ?? 0), color: "text-slate-800" },
                { label: "Cash Refunds", value: `-ج.م${fmt(shift.totalRefunds ?? 0)}`, color: "text-red-600" },
                { label: "Expected Cash", value: shift.expectedCash != null ? `ج.م${fmt(shift.expectedCash)}` : "—", color: "text-slate-800" },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                  <p className={`font-bold text-sm ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Events */}
          {shift.events && shift.events.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Cash Drawer Events ({shift.events.length})
              </h3>
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                {shift.events.map((ev: any) => (
                  <div key={ev._id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          ev.type === "cash_in"
                            ? "bg-emerald-100"
                            : ev.type === "cash_out"
                            ? "bg-rose-100"
                            : "bg-slate-200"
                        }`}
                      >
                        {ev.type === "cash_in" ? (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
                        ) : ev.type === "cash_out" ? (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{ev.reason}</p>
                        <p className="text-xs text-slate-400">
                          {ev.userName} · {fmtTime(ev._creationTime)}
                        </p>
                      </div>
                    </div>
                    {ev.amount != null && (
                      <p
                        className={`text-sm font-bold ${
                          ev.type === "cash_in" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {ev.type === "cash_in" ? "+" : "-"}${fmt(ev.amount)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {(shift.notes || shift.closingNotes) && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes</h3>
              <div className="space-y-2">
                {shift.notes && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-400 mb-1">Opening Notes</p>
                    <p className="text-sm text-slate-700">{shift.notes}</p>
                  </div>
                )}
                {shift.closingNotes && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-400 mb-1">Closing Notes</p>
                    <p className="text-sm text-slate-700">{shift.closingNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
