import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  RotateCcw, Plus, Search, X, CheckCircle, Clock,
  XCircle, AlertCircle, DollarSign, Package, Eye,
  Trash2, ChevronDown, RefreshCw, ShoppingBag,
} from "lucide-react";
import jsPDF from "jspdf";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReturnStatus = "pending" | "approved" | "rejected" | "completed";
type RefundMethod = "cash" | "credit" | "store_credit" | "exchange";
type ItemCondition = "resalable" | "damaged" | "defective";

interface ReturnItem {
  productId: Id<"products">;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
  condition: ItemCondition;
  restockQty: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: Clock },
  approved:  { label: "Approved",  color: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700",       icon: XCircle },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
};

const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash:         "Cash",
  credit:       "Credit Card",
  store_credit: "Store Credit",
  exchange:     "Exchange",
};

const CONDITION_CONFIG: Record<ItemCondition, { label: string; color: string }> = {
  resalable: { label: "Resalable",  color: "bg-emerald-100 text-emerald-700" },
  damaged:   { label: "Damaged",    color: "bg-amber-100 text-amber-700" },
  defective: { label: "Defective",  color: "bg-red-100 text-red-700" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReturnStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReturnsPage({
  selectedStoreId,
  stores,
  isManager,
}: {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "">("");
  const [listSearch, setListSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedReturnId, setSelectedReturnId] = useState<Id<"returns"> | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: Id<"returns">; notes: string } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const returns = useQuery(api.returns.list, {
    storeId: selectedStoreId ?? undefined,
    status: statusFilter || undefined,
  });
  const stats = useQuery(api.returns.getStats, { storeId: selectedStoreId ?? undefined });
  const selectedReturn = useQuery(
    api.returns.list,
    selectedReturnId ? { storeId: undefined, status: undefined, limit: 500 } : "skip"
  );
  // Get the specific return from the list
  const returnDetail = selectedReturn?.find((r) => r._id === selectedReturnId) ?? null;

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createReturn = useMutation(api.returns.create);
  const approveReturn = useMutation(api.returns.approve);
  const rejectReturn = useMutation(api.returns.reject);
  const removeReturn = useMutation(api.returns.remove);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleApprove = async (id: Id<"returns">) => {
    if (!confirm("Approve this return? Inventory will be restocked automatically.")) return;
    try {
      await approveReturn({ returnId: id });
      toast.success("Return approved and inventory restocked");
      if (selectedReturnId === id) setSelectedReturnId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve return");
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await rejectReturn({ returnId: rejectModal.id, notes: rejectModal.notes || undefined });
      toast.success("Return rejected");
      setRejectModal(null);
      if (selectedReturnId === rejectModal.id) setSelectedReturnId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject return");
    }
  };

  const handleDelete = async (id: Id<"returns">) => {
    if (!confirm("Delete this return request?")) return;
    try {
      await removeReturn({ returnId: id });
      toast.success("Return deleted");
      if (selectedReturnId === id) setSelectedReturnId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete return");
    }
  };

  const exportPDF = (ret: any) => {
    const store = stores.find((s) => s._id === ret.storeId);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("RETURN & REFUND", pageW / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(store?.name ?? "POS System", pageW / 2, y, { align: "center" });
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Return #: ${ret.returnNumber}`, 15, y);
    doc.text(`Date: ${new Date(ret._creationTime).toLocaleDateString()}`, pageW - 15, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${STATUS_CONFIG[ret.status as ReturnStatus]?.label ?? ret.status}`, 15, y);
    doc.text(`Refund Method: ${REFUND_METHOD_LABELS[ret.refundMethod as RefundMethod] ?? ret.refundMethod}`, pageW - 15, y, { align: "right" });
    y += 6;
    if (ret.customerName) {
      doc.text(`Customer: ${ret.customerName}${ret.customerPhone ? ` | ${ret.customerPhone}` : ""}`, 15, y);
      y += 6;
    }
    if (ret.saleId) {
      doc.text(`Original Sale ID: ${ret.saleId}`, 15, y);
      y += 6;
    }
    y += 4;

    // Items header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y - 3, pageW - 30, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Product", 17, y + 2);
    doc.text("Qty", 100, y + 2, { align: "right" });
    doc.text("Unit Price", 125, y + 2, { align: "right" });
    doc.text("Condition", 155, y + 2, { align: "right" });
    doc.text("Refund", pageW - 17, y + 2, { align: "right" });
    y += 10;

    doc.setFont("helvetica", "normal");
    for (const item of ret.items) {
      doc.text(item.productName.substring(0, 40), 17, y);
      doc.text(String(item.quantity), 100, y, { align: "right" });
      doc.text(`EGP ${item.unitPrice.toFixed(2)}`, 125, y, { align: "right" });
      doc.text(item.condition, 155, y, { align: "right" });
      doc.text(`EGP ${item.total.toFixed(2)}`, pageW - 17, y, { align: "right" });
      y += 6;
      if (item.reason) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`  Reason: ${item.reason}`, 17, y);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    }

    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total Refund:", pageW - 60, y);
      doc.text(`EGP ${ret.totalRefund.toFixed(2)}`, pageW - 17, y, { align: "right" });
    y += 8;

    if (ret.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Notes: ${ret.notes}`, 15, y);
    }

    doc.save(`${ret.returnNumber}.pdf`);
  };

  const storeName = (id: Id<"stores">) => stores.find((s) => s._id === id)?.name ?? "Unknown";

  return (
    <div className="flex h-full">
      {/* ── Left Panel: List ─────────────────────────────────────────────────── */}
      <div className={`flex flex-col ${selectedReturnId ? "w-1/2 border-r border-slate-200" : "w-full"} bg-slate-50`}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Returns & Refunds</h1>
                <p className="text-xs text-slate-500">
                  {selectedStoreId ? storeName(selectedStoreId) : "All Stores"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Return
            </button>
          </div>

          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              <StatCard label="Total" value={stats.total} color="text-slate-700" />
              <StatCard label="Pending" value={stats.pending} color="text-amber-600" />
              <StatCard label="Completed" value={stats.completed} color="text-emerald-600" />
              <StatCard
                label="Total Refunded"
                value={`ج.م${stats.totalRefunded.toFixed(2)}`}
                color="text-blue-600"
              />
            </div>
          )}

          {/* Search by return number or sale number */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search by return # or sale number…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {listSearch && (
              <button
                onClick={() => setListSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {(["", "pending", "approved", "rejected", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "" ? "All" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {returns === undefined ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (() => {
            // Client-side filter by return number or customer name
            const q = listSearch.trim().toLowerCase();
            const filtered = q
              ? returns.filter((r) =>
                  r.returnNumber?.toLowerCase().includes(q) ||
                  r.customerName?.toLowerCase().includes(q) ||
                  r.customerPhone?.includes(q)
                )
              : returns;

            if (filtered.length === 0) return (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <RotateCcw className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-semibold mb-1">No returns found</p>
                <p className="text-slate-400 text-sm">
                  {listSearch ? `No results for "${listSearch}"` : statusFilter ? `No ${STATUS_CONFIG[statusFilter].label.toLowerCase()} returns` : "Create a new return to get started"}
                </p>
              </div>
            );

            return filtered.map((ret) => (
              <ReturnCard
                key={ret._id}
                ret={ret}
                isSelected={selectedReturnId === ret._id}
                isManager={isManager}
                storeName={storeName(ret.storeId)}
                onSelect={() => setSelectedReturnId(selectedReturnId === ret._id ? null : ret._id)}
                onApprove={() => handleApprove(ret._id)}
                onReject={() => setRejectModal({ id: ret._id, notes: "" })}
                onDelete={() => handleDelete(ret._id)}
                onExport={() => exportPDF(ret)}
              />
            ));
          })()}
        </div>
      </div>

      {/* ── Right Panel: Detail ──────────────────────────────────────────────── */}
      {selectedReturnId && (
        <div className="w-1/2 flex flex-col bg-white overflow-y-auto">
          <ReturnDetailPanel
            ret={returns?.find((r) => r._id === selectedReturnId) ?? null}
            isManager={isManager}
            stores={stores}
            onClose={() => setSelectedReturnId(null)}
            onApprove={() => handleApprove(selectedReturnId)}
            onReject={() => setRejectModal({ id: selectedReturnId, notes: "" })}
            onDelete={() => handleDelete(selectedReturnId)}
            onExport={exportPDF}
          />
        </div>
      )}

      {/* ── Create Return Modal ──────────────────────────────────────────────── */}
      {showForm && (
        <CreateReturnModal
          stores={stores}
          selectedStoreId={selectedStoreId}
          onClose={() => setShowForm(false)}
          onCreate={createReturn}
        />
      )}

      {/* ── Reject Modal ─────────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Reject Return</h3>
            <p className="text-sm text-slate-500 mb-4">
              Optionally provide a reason for rejection.
            </p>
            <textarea
              value={rejectModal.notes}
              onChange={(e) => setRejectModal({ ...rejectModal, notes: e.target.value })}
              placeholder="Rejection reason (optional)..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Reject Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linked Sale Number (fetches sale number from saleId) ──────────────────────

function LinkedSaleNumber({ saleId }: { saleId: Id<"sales"> }) {
  const sale = useQuery(api.sales.get, { saleId });
  if (!sale) return <p className="text-xs text-slate-400 mt-1 font-mono">Sale: {saleId.slice(0, 12)}…</p>;
  return (
    <div className="flex items-center gap-2 mt-1">
      <ShoppingBag className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      {sale.saleNumber ? (
        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-mono">
          {sale.saleNumber}
        </span>
      ) : (
        <span className="text-xs text-slate-500 font-mono">{saleId.slice(0, 16)}…</span>
      )}
      <span className="text-xs text-slate-400">
        ج.م{sale.total.toFixed(2)} · {new Date(sale._creationTime).toLocaleDateString()}
      </span>
    </div>
  );
}

// Compact chip version for the list card
function LinkedSaleChip({ saleId }: { saleId: Id<"sales"> }) {
  const sale = useQuery(api.sales.get, { saleId });
  if (!sale?.saleNumber) return null;
  return (
    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
      {sale.saleNumber}
    </span>
  );
}

// ── Return Card ───────────────────────────────────────────────────────────────

function ReturnCard({
  ret, isSelected, isManager, storeName,
  onSelect, onApprove, onReject, onDelete, onExport,
}: {
  ret: any;
  isSelected: boolean;
  isManager: boolean;
  storeName: string;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? "border-blue-400 shadow-md shadow-blue-100"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800 text-sm">{ret.returnNumber}</span>
              <StatusBadge status={ret.status} />
            </div>
            <p className="text-xs text-slate-500 truncate">
              {storeName}
              {ret.customerName ? ` · ${ret.customerName}` : ""}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-slate-400">
                {ret.items.length} item{ret.items.length !== 1 ? "s" : ""} ·{" "}
                {REFUND_METHOD_LABELS[ret.refundMethod as RefundMethod] ?? ret.refundMethod}
              </p>
              {ret.saleId && <LinkedSaleChip saleId={ret.saleId} />}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold text-slate-800">ج.م{ret.totalRefund.toFixed(2)}</p>
            <p className="text-xs text-slate-400">
              {new Date(ret._creationTime).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action buttons — only show on hover / selected */}
        {(isSelected || ret.status === "pending") && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
            {isManager && ret.status === "pending" && (
              <>
                <button
                  onClick={onApprove}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" />
                  Approve
                </button>
                <button
                  onClick={onReject}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Reject
                </button>
              </>
            )}
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors ml-auto"
            >
              <Eye className="w-3 h-3" />
              PDF
            </button>
            {ret.status !== "completed" && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function ReturnDetailPanel({
  ret, isManager, stores, onClose, onApprove, onReject, onDelete, onExport,
}: {
  ret: any;
  isManager: boolean;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onExport: (ret: any) => void;
}) {
  if (!ret) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const store = stores.find((s) => s._id === ret.storeId);

  return (
    <>
      {/* Panel Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{ret.returnNumber}</h2>
              <StatusBadge status={ret.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {store?.name} · {new Date(ret._creationTime).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport(ret)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Total Refund</p>
            <p className="text-2xl font-bold text-slate-800">ج.م{ret.totalRefund.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Refund Method</p>
            <p className="text-base font-bold text-slate-800">
              {REFUND_METHOD_LABELS[ret.refundMethod as RefundMethod] ?? ret.refundMethod}
            </p>
          </div>
        </div>

        {/* Customer Info */}
        {(ret.customerName || ret.saleId || ret.saleNumber) && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Customer / Sale</p>
            {ret.customerName && (
              <p className="text-sm text-slate-700 font-medium">{ret.customerName}</p>
            )}
            {ret.customerPhone && (
              <p className="text-xs text-slate-500">{ret.customerPhone}</p>
            )}
            {ret.saleId && (
              <LinkedSaleNumber saleId={ret.saleId} />
            )}
          </div>
        )}

        {/* Items */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Returned Items ({ret.items.length})
          </p>
          <div className="space-y-2">
            {ret.items.map((item: any, idx: number) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.quantity} × ج.م{item.unitPrice.toFixed(2)}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{item.reason}"</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">ج.م{item.total.toFixed(2)}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CONDITION_CONFIG[item.condition as ItemCondition]?.color ?? "bg-slate-100 text-slate-600"}`}>
                      {CONDITION_CONFIG[item.condition as ItemCondition]?.label ?? item.condition}
                    </span>
                  </div>
                </div>
                {item.restockQty > 0 && item.restockQty < item.quantity && (
                  <p className="text-xs text-amber-600 mt-2">
                    Partial restock: {item.restockQty} of {item.quantity} units returned to stock
                  </p>
                )}
                {item.restockQty === 0 && (
                  <p className="text-xs text-red-500 mt-2">Not restocked (damaged/defective)</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {ret.notes && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-slate-700">{ret.notes}</p>
          </div>
        )}

        {/* Manager Actions */}
        {isManager && ret.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Restock
            </button>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}

        {ret.status !== "completed" && (
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Return
          </button>
        )}
      </div>
    </>
  );
}

// ── Create Return Modal ───────────────────────────────────────────────────────

function CreateReturnModal({
  stores, selectedStoreId, onClose, onCreate,
}: {
  stores: Array<{ _id: Id<"stores">; name: string }>;
  selectedStoreId: Id<"stores"> | null;
  onClose: () => void;
  onCreate: any;
}) {
  const [storeId, setStoreId] = useState<Id<"stores"> | "">(selectedStoreId ?? stores[0]?._id ?? "");
  const [saleSearch, setSaleSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<Id<"sales"> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Detect if search looks like a sale number (contains digits or dashes)
  const looksLikeSaleNumber = saleSearch.trim().length > 0;

  // Search by sale number using the search index
  const saleNumberResults = useQuery(
    api.sales.searchByNumber,
    looksLikeSaleNumber ? { searchText: saleSearch.trim() } : "skip"
  );

  // Look up recent sales for the selected store (fallback when no search)
  const recentSales = useQuery(api.sales.list, {
    storeId: storeId ? (storeId as Id<"stores">) : undefined,
    status: "completed",
    limit: 50,
  });

  // Product search
  const productResults = useQuery(
    api.products.search,
    productSearch.trim().length > 1 ? { query: productSearch } : "skip"
  );

  // Merge: if searching, use sale number results + filter recent by name/phone
  // If not searching, show recent 10
  const namePhoneMatches = saleSearch.trim()
    ? recentSales?.filter((s) =>
        s.customerName?.toLowerCase().includes(saleSearch.toLowerCase()) ||
        s.customerPhone?.includes(saleSearch)
      ) ?? []
    : [];

  // Combine sale number results + name/phone matches, deduplicate by _id
  const combined = saleSearch.trim()
    ? [
        ...(saleNumberResults ?? []),
        ...namePhoneMatches.filter(
          (s) => !(saleNumberResults ?? []).find((r) => r._id === s._id)
        ),
      ]
    : recentSales?.slice(0, 10) ?? [];

  const filteredSales = combined;

  // Get selected sale from either source
  const selectedSale =
    recentSales?.find((s) => s._id === selectedSaleId) ??
    saleNumberResults?.find((s) => s._id === selectedSaleId) ??
    null;

  const addItemFromSale = (saleItem: any) => {
    if (items.find((i) => i.productId === saleItem.productId)) {
      toast.info("Item already added");
      return;
    }
    setItems([...items, {
      productId: saleItem.productId,
      productName: saleItem.productName,
      quantity: 1,
      unitPrice: saleItem.unitPrice,
      total: saleItem.unitPrice,
      reason: "",
      condition: "resalable",
      restockQty: 1,
    }]);
  };

  const addItemFromSearch = (product: any) => {
    if (items.find((i) => i.productId === product._id)) {
      toast.info("Item already added");
      return;
    }
    setItems([...items, {
      productId: product._id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.userPrice,
      total: product.userPrice,
      reason: "",
      condition: "resalable",
      restockQty: 1,
    }]);
    setProductSearch("");
  };

  const updateItem = (idx: number, field: keyof ReturnItem, val: any) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      if (field === "quantity" || field === "unitPrice") {
        updated.total = updated.quantity * updated.unitPrice;
        // Auto-set restockQty to match quantity for resalable, 0 for damaged/defective
        if (field === "quantity" && updated.condition === "resalable") {
          updated.restockQty = updated.quantity;
        }
      }
      if (field === "condition") {
        if (val === "resalable") updated.restockQty = updated.quantity;
        else if (val === "damaged" || val === "defective") updated.restockQty = 0;
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totalRefund = items.reduce((s, i) => s + i.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) { toast.error("Select a store"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSubmitting(true);
    try {
      const result = await onCreate({
        storeId: storeId as Id<"stores">,
        saleId: selectedSaleId ?? undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items,
        totalRefund,
        refundMethod,
        notes: notes.trim() || undefined,
      });
      toast.success(`Return ${result.returnNumber} created successfully`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">New Return / Refund</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Store + Customer */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Store *</label>
                <div className="relative">
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value as Id<"stores">)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none bg-white"
                    required
                  >
                    <option value="">Select store...</option>
                    {stores.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Refund Method *</label>
                <div className="relative">
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none bg-white"
                  >
                    {Object.entries(REFUND_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer Phone</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Link to Original Sale */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Link to Original Sale
                <span className="text-slate-400 font-normal ml-1">(optional — search by sale number, customer name or phone)</span>
              </label>
              {selectedSale ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <ShoppingBag className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedSale.saleNumber && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-mono">
                          {selectedSale.saleNumber}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedSale.customerName ?? "Walk-in Customer"}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ج.م{selectedSale.total.toFixed(2)} · {new Date(selectedSale._creationTime).toLocaleDateString()}
                      · {selectedSale.items.length} item{selectedSale.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSale.customerName) setCustomerName(selectedSale.customerName);
                        if (selectedSale.customerPhone) setCustomerPhone(selectedSale.customerPhone);
                        const newItems = selectedSale.items
                          .filter((si: any) => !items.find((i) => i.productId === si.productId))
                          .map((si: any) => ({
                            productId: si.productId,
                            productName: si.productName,
                            quantity: si.quantity,
                            unitPrice: si.unitPrice,
                            total: si.total,
                            reason: "",
                            condition: "resalable" as ItemCondition,
                            restockQty: si.quantity,
                          }));
                        setItems([...items, ...newItems]);
                        toast.success("Sale items added — adjust quantities as needed");
                      }}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                    >
                      Import Items
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedSaleId(null); setSaleSearch(""); }}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    placeholder="Type sale number (e.g. فرع المعادي-00001), customer name or phone…"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {filteredSales.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-56 overflow-y-auto">
                      {filteredSales.map((sale) => (
                        <button
                          key={sale._id}
                          type="button"
                          onClick={() => { setSelectedSaleId(sale._id); setSaleSearch(""); }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            {sale.saleNumber && (
                              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-mono">
                                {sale.saleNumber}
                              </span>
                            )}
                            <p className="text-sm font-semibold text-slate-800">
                              {sale.customerName ?? "Walk-in"}
                            </p>
                            <span className="text-sm font-bold text-slate-700 ml-auto">
                              ج.م{sale.total.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {new Date(sale._creationTime).toLocaleDateString()} · {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                            {sale.customerPhone ? ` · ${sale.customerPhone}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {saleSearch.trim() && filteredSales.length === 0 && saleNumberResults !== undefined && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 px-4 py-3 text-sm text-slate-400 text-center">
                      No sales found for "{saleSearch}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product Search (walk-in returns) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Add Items Manually <span className="text-slate-400 font-normal">(search products)</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products to add..."
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {productResults && productResults.length > 0 && productSearch.trim().length > 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {productResults.map((p: any) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => addItemFromSearch(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <p className="text-sm font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">${p.userPrice.toFixed(2)} · {p.category}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Return Items ({items.length})
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Product</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 w-16">Qty</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 w-20">Price</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 w-24">Condition</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-slate-500 w-16">Restock</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-20">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800 text-xs truncate max-w-[140px]">{item.productName}</p>
                            <input
                              value={item.reason}
                              onChange={(e) => updateItem(idx, "reason", e.target.value)}
                              placeholder="Reason..."
                              className="mt-1 w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full text-center px-1 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="w-full text-center px-1 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.condition}
                              onChange={(e) => updateItem(idx, "condition", e.target.value as ItemCondition)}
                              className="w-full px-1 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            >
                              <option value="resalable">Resalable</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={item.restockQty}
                              onChange={(e) => updateItem(idx, "restockQty", Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)))}
                              className="w-full text-center px-1 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 text-xs">
                            ج.م{item.total.toFixed(2)}
                          </td>
                          <td className="pr-2">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Refund</p>
                <p className="text-2xl font-bold text-slate-800">ج.م{totalRefund.toFixed(2)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || items.length === 0}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Submit Return"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
