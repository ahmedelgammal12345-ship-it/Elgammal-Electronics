import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  PackageCheck, Plus, X, Check, Search, ChevronDown,
  AlertTriangle, Clock, Warehouse, Store, Package,
  ArrowRight, Filter, Eye, CheckCircle, XCircle,
  Loader2, Zap, TrendingUp, RefreshCw, Info,
  ClipboardList, Truck, AlertCircle,
} from "lucide-react";

interface FulfillmentPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

type ViewTab = "all" | "pending" | "approved" | "fulfilled" | "cancelled";
type ModalType = "create" | "fulfill" | "detail" | null;

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500", icon: Clock },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", icon: CheckCircle },
  partially_fulfilled: { label: "Partial", color: "bg-violet-100 text-violet-700", dot: "bg-violet-500", icon: TrendingUp },
  fulfilled: { label: "Fulfilled", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-500", dot: "bg-slate-400", icon: XCircle },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-slate-100 text-slate-500" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600" },
};

export default function FulfillmentPage({ selectedStoreId, stores, isManager }: FulfillmentPageProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [search, setSearch] = useState("");

  const statusFilter = activeTab === "all" ? undefined : activeTab as any;

  const requests = useQuery(api.fulfillment.list, {
    storeId: selectedStoreId ?? undefined,
    status: statusFilter,
    limit: 100,
  });

  const stats = useQuery(api.fulfillment.getStats, {
    storeId: selectedStoreId ?? undefined,
  });

  const warehouses = useQuery(api.warehouses.list, { activeOnly: true });

  const filtered = useMemo(() => {
    if (!requests) return [];
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(
      (r) =>
        r.requestNumber.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q) ||
        r.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  }, [requests, search]);

  const openDetail = (req: any) => {
    setSelectedRequest(req);
    setModal("detail");
  };

  const openFulfill = (req: any) => {
    setSelectedRequest(req);
    setModal("fulfill");
  };

  const tabs: { id: ViewTab; label: string; count?: number }[] = [
    { id: "all", label: "All", count: stats?.total },
    { id: "pending", label: "Pending", count: stats?.pending },
    { id: "approved", label: "Approved", count: stats?.approved },
    { id: "fulfilled", label: "Fulfilled", count: stats?.fulfilled },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <PackageCheck className="w-5 h-5 text-white" />
            </div>
            Fulfillment Requests
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-13">
            Request stock from warehouses · Track delivery to stores
          </p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-violet-500/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          color="amber"
          urgent={stats?.urgent}
        />
        <StatCard label="Approved" value={stats?.approved ?? 0} icon={CheckCircle} color="blue" />
        <StatCard label="Fulfilled" value={stats?.fulfilled ?? 0} icon={PackageCheck} color="emerald" />
        <StatCard label="Total" value={stats?.total ?? 0} icon={ClipboardList} color="slate" />
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.id ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests…"
            className="pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white w-52"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {requests === undefined ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading requests…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <PackageCheck className="w-8 h-8 text-violet-300" />
            </div>
            <p className="font-semibold text-slate-600 text-lg">No requests found</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">
              {activeTab === "all"
                ? "Create your first fulfillment request to get stock from a warehouse"
                : `No ${activeTab} requests`}
            </p>
            <button
              onClick={() => setModal("create")}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              Create Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-b from-violet-50 to-violet-100/40 border-b border-violet-100">
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Request #</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Store</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Warehouse</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Items</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Priority</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((req) => {
                  const sc = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                  const pc = PRIORITY_CONFIG[req.priority as keyof typeof PRIORITY_CONFIG];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={req._id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-800 text-xs">{req.requestNumber}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Store className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-sm">{req.storeName}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Warehouse className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-sm">{req.warehouseName}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            {req.items.length} item{req.items.length !== 1 ? "s" : ""}
                          </span>
                          <span className="text-xs text-slate-400">
                            {req.items.reduce((s, i) => s + i.requestedQty, 0)} units
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pc.color}`}>
                          {req.priority === "urgent" && "🔴 "}
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        {new Date(req._creationTime).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openDetail(req)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isManager && (req.status === "pending" || req.status === "approved") && (
                            <button
                              onClick={() => openFulfill(req)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                              title="Fulfill request"
                            >
                              <Truck className="w-3 h-3" />
                              Fulfill
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {modal === "create" && (
        <CreateRequestModal
          stores={stores}
          selectedStoreId={selectedStoreId}
          warehouses={warehouses ?? []}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── FULFILL MODAL ── */}
      {modal === "fulfill" && selectedRequest && (
        <FulfillModal
          request={selectedRequest}
          onClose={() => { setModal(null); setSelectedRequest(null); }}
        />
      )}

      {/* ── DETAIL MODAL ── */}
      {modal === "detail" && selectedRequest && (
        <DetailModal
          request={selectedRequest}
          isManager={isManager}
          onClose={() => { setModal(null); setSelectedRequest(null); }}
          onFulfill={() => { setModal("fulfill"); }}
        />
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, urgent,
}: {
  label: string; value: number; icon: React.ElementType;
  color: "amber" | "blue" | "emerald" | "slate"; urgent?: number;
}) {
  const colors = {
    amber: "from-amber-50 to-amber-100/50 border-amber-100",
    blue: "from-blue-50 to-blue-100/50 border-blue-100",
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-100",
    slate: "from-slate-50 to-slate-100/50 border-slate-100",
  };
  const iconColors = {
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    slate: "bg-slate-100 text-slate-500",
  };
  const textColors = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconColors[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        {urgent !== undefined && urgent > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">
            {urgent} urgent
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
    </div>
  );
}

// ── Create Request Modal ───────────────────────────────────────────────────────
function CreateRequestModal({
  stores, selectedStoreId, warehouses, onClose,
}: {
  stores: Array<{ _id: Id<"stores">; name: string }>;
  selectedStoreId: Id<"stores"> | null;
  warehouses: Array<{ _id: Id<"warehouses">; name: string; code?: string; isActive: boolean }>;
  onClose: () => void;
}) {
  const createRequest = useMutation(api.fulfillment.create);

  const [storeId, setStoreId] = useState<string>(selectedStoreId ?? "");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "normal" | "urgent">("normal");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState<Array<{
    productId: Id<"products">;
    productName: string;
    requestedQty: number;
    warehouseStock?: number;
  }>>([]);
  const [submitting, setSubmitting] = useState(false);

  const productResults = useQuery(
    api.products.search,
    productSearch.length >= 2 ? { query: productSearch } : "skip"
  );

  // Load warehouse stock for selected warehouse
  const warehouseStock = useQuery(
    api.warehouses.getStock,
    warehouseId ? { warehouseId: warehouseId as Id<"warehouses"> } : "skip"
  );

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    (warehouseStock ?? []).forEach((s) => m.set(s.productId, s.quantity));
    return m;
  }, [warehouseStock]);

  const addProduct = (p: { _id: Id<"products">; name: string }) => {
    if (items.some((i) => i.productId === p._id)) {
      toast.error("Product already added");
      return;
    }
    setItems([...items, {
      productId: p._id,
      productName: p.name,
      requestedQty: 1,
      warehouseStock: stockMap.get(p._id),
    }]);
    setProductSearch("");
  };

  const updateQty = (idx: number, qty: number) => {
    setItems(items.map((item, i) => i === idx ? { ...item, requestedQty: Math.max(1, qty) } : item));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) { toast.error("Please select a store"); return; }
    if (!warehouseId) { toast.error("Please select a warehouse"); return; }
    if (items.length === 0) { toast.error("Please add at least one product"); return; }

    setSubmitting(true);
    try {
      await createRequest({
        storeId: storeId as Id<"stores">,
        warehouseId: warehouseId as Id<"warehouses">,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          requestedQty: i.requestedQty,
          warehouseStock: i.warehouseStock,
        })),
        priority,
        notes: notes || undefined,
      });
      toast.success("Fulfillment request created!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <PackageCheck className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">New Fulfillment Request</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Store + Warehouse */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Requesting Store <span className="text-red-500">*</span>
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white"
              >
                <option value="">— Select store —</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Source Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white"
              >
                <option value="">— Select warehouse —</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}{w.code ? ` (${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Priority
            </label>
            <div className="flex gap-2">
              {(["low", "normal", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    priority === p
                      ? p === "urgent"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : p === "normal"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-400 bg-slate-50 text-slate-700"
                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {p === "urgent" && "🔴 "}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Product Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Add Products <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search product name or barcode…"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
              />
              {productResults && productResults.length > 0 && productSearch.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                  {productResults.slice(0, 10).map((p) => {
                    const wStock = stockMap.get(p._id);
                    const alreadyAdded = items.some((i) => i.productId === p._id);
                    return (
                      <button
                        key={p._id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addProduct(p)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0 ${
                          alreadyAdded
                            ? "opacity-40 cursor-not-allowed bg-slate-50"
                            : "hover:bg-violet-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span className="text-slate-400 text-xs ml-2">{p.category}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {warehouseId && (
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                wStock === undefined
                                  ? "bg-slate-100 text-slate-400"
                                  : wStock === 0
                                  ? "bg-red-100 text-red-600"
                                  : wStock <= 5
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-emerald-100 text-emerald-600"
                              }`}>
                                {wStock === undefined ? "No stock data" : `${wStock} in WH`}
                              </span>
                            )}
                            {alreadyAdded && (
                              <span className="text-slate-400">Added</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {items.length} Product{items.length !== 1 ? "s" : ""} · {items.reduce((s, i) => s + i.requestedQty, 0)} total units
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map((item, idx) => (
                  <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                      {item.warehouseStock !== undefined && (
                        <p className={`text-xs ${
                          item.warehouseStock === 0
                            ? "text-red-500"
                            : item.warehouseStock < item.requestedQty
                            ? "text-amber-500"
                            : "text-emerald-600"
                        }`}>
                          {item.warehouseStock === 0
                            ? "⚠ No stock in warehouse"
                            : item.warehouseStock < item.requestedQty
                            ? `⚠ Only ${item.warehouseStock} available in warehouse`
                            : `✓ ${item.warehouseStock} available in warehouse`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.requestedQty - 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={item.requestedQty}
                        onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                        className="w-14 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold focus:border-violet-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.requestedQty + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for request, special instructions…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fulfill Modal ─────────────────────────────────────────────────────────────
function FulfillModal({
  request, onClose,
}: {
  request: any;
  onClose: () => void;
}) {
  const fulfillRequest = useMutation(api.fulfillment.fulfill);
  const approveRequest = useMutation(api.fulfillment.approve);
  const cancelRequest = useMutation(api.fulfillment.cancel);

  const [fulfilledQtys, setFulfilledQtys] = useState<Record<string, number>>(
    Object.fromEntries(request.items.map((i: any) => [i.productId, i.requestedQty]))
  );
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [deductFromWarehouse, setDeductFromWarehouse] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const handleApprove = async () => {
    try {
      await approveRequest({ requestId: request._id });
      toast.success("Request approved!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleFulfill = async () => {
    setSubmitting(true);
    try {
      await fulfillRequest({
        requestId: request._id,
        fulfilledItems: request.items.map((i: any) => ({
          productId: i.productId,
          fulfilledQty: fulfilledQtys[i.productId] ?? 0,
        })),
        fulfillmentNotes: fulfillmentNotes || undefined,
        deductFromWarehouse,
      });
      toast.success("Request fulfilled successfully!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fulfillment failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest({ requestId: request._id, reason: cancelReason || undefined });
      toast.success("Request cancelled");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  const sc = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900">Fulfill Request</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{request.requestNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Route info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2 text-sm">
              <Warehouse className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">{request.warehouseName}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <div className="flex items-center gap-2 text-sm">
              <Store className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">{request.storeName}</span>
            </div>
            <div className="ml-auto">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG].color
              }`}>
                {request.priority === "urgent" && "🔴 "}
                {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
              </span>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Items to Fulfill
            </p>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
              {request.items.map((item: any) => (
                <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                    <p className="text-xs text-slate-400">
                      Requested: <span className="font-semibold text-slate-600">{item.requestedQty}</span>
                      {item.warehouseStock !== undefined && (
                        <span className={`ml-2 ${
                          item.warehouseStock < (fulfilledQtys[item.productId] ?? 0)
                            ? "text-amber-500"
                            : "text-emerald-600"
                        }`}>
                          · {item.warehouseStock} in warehouse
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Send:</span>
                    <input
                      type="number"
                      min={0}
                      max={item.requestedQty}
                      value={fulfilledQtys[item.productId] ?? 0}
                      onChange={(e) => setFulfilledQtys({
                        ...fulfilledQtys,
                        [item.productId]: Math.max(0, parseInt(e.target.value) || 0),
                      })}
                      className="w-16 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold focus:border-emerald-500 outline-none"
                    />
                    <span className="text-xs text-slate-400">/ {item.requestedQty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deduct from warehouse toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-slate-700">Deduct from warehouse stock</p>
              <p className="text-xs text-slate-400 mt-0.5">Automatically reduce warehouse inventory levels</p>
            </div>
            <button
              type="button"
              onClick={() => setDeductFromWarehouse(!deductFromWarehouse)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                deductFromWarehouse ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                deductFromWarehouse ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {/* Fulfillment notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Fulfillment Notes
            </label>
            <textarea
              value={fulfillmentNotes}
              onChange={(e) => setFulfillmentNotes(e.target.value)}
              placeholder="Dispatch notes, tracking info, partial fulfillment reason…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none resize-none"
            />
          </div>

          {/* Cancel section */}
          {showCancel ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-red-700">Cancel this request?</p>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:border-red-400 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Keep Request
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {request.status === "pending" && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              )}
              <button
                onClick={handleFulfill}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Fulfill & Dispatch
              </button>
              <button
                onClick={() => setShowCancel(true)}
                className="px-3 py-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({
  request, isManager, onClose, onFulfill,
}: {
  request: any;
  isManager: boolean;
  onClose: () => void;
  onFulfill: () => void;
}) {
  const sc = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
  const pc = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG];
  const StatusIcon = sc.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900">{request.requestNumber}</h2>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${sc.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pc.color}`}>
                {request.priority === "urgent" && "🔴 "}
                {pc.label}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {new Date(request._creationTime).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Route */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-emerald-50 rounded-xl border border-violet-100">
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-1">
                <Warehouse className="w-5 h-5 text-violet-600" />
              </div>
              <p className="text-xs font-semibold text-slate-700">{request.warehouseName}</p>
              <p className="text-xs text-slate-400">Warehouse</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-1">
                <div className="w-8 h-0.5 bg-slate-300" />
                <Truck className="w-4 h-4 text-slate-400" />
                <div className="w-8 h-0.5 bg-slate-300" />
              </div>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                <Store className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-700">{request.storeName}</p>
              <p className="text-xs text-slate-400">Store</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Items ({request.items.length})
            </p>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
              {request.items.map((item: any) => {
                const fulfilled = item.fulfilledQty ?? 0;
                const pct = item.requestedQty > 0 ? (fulfilled / item.requestedQty) * 100 : 0;
                return (
                  <div key={item.productId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-800">{item.productName}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">
                          {fulfilled > 0 ? `${fulfilled} / ` : ""}{item.requestedQty} units
                        </span>
                        {fulfilled > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                            pct >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {Math.round(pct)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {fulfilled > 0 && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 100 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Request Notes</p>
              <p className="text-sm text-slate-600 italic">{request.notes}</p>
            </div>
          )}
          {request.fulfillmentNotes && (
            <div className="p-3 bg-emerald-50 rounded-xl">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Fulfillment Notes</p>
              <p className="text-sm text-emerald-700 italic">{request.fulfillmentNotes}</p>
            </div>
          )}

          {/* Fulfilled at */}
          {request.fulfilledAt && (
            <p className="text-xs text-slate-400 text-center">
              Fulfilled on {new Date(request.fulfilledAt).toLocaleString()}
            </p>
          )}

          {/* Actions */}
          {isManager && (request.status === "pending" || request.status === "approved") && (
            <button
              onClick={onFulfill}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Truck className="w-4 h-4" />
              Fulfill This Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
