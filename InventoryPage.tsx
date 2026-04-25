import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Package,
  Plus,
  Minus,
  RefreshCw,
  Trash2,
  RotateCcw,
  Search,
  ChevronDown,
  X,
  History,
  TrendingDown,
  Download,
  SlidersHorizontal,
} from "lucide-react";

interface InventoryPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

const ADJUSTMENT_TYPES = [
  { value: "add", label: "Add Stock", icon: Plus, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  { value: "remove", label: "Remove Stock", icon: Minus, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  { value: "set", label: "Set Quantity", icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { value: "damage", label: "Mark Damaged", icon: Trash2, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  { value: "return", label: "Customer Return", icon: RotateCcw, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
] as const;

const REASONS: Record<string, string[]> = {
  add: ["Restocking", "Purchase order received", "Transfer from another store", "Correction", "Other"],
  remove: ["Sold offline", "Transfer to another store", "Expired", "Correction", "Other"],
  set: ["Physical count / stocktake", "System correction", "Initial setup", "Other"],
  damage: ["Water damage", "Physical damage", "Expired", "Quality issue", "Other"],
  return: ["Customer return - good condition", "Customer return - damaged", "Warranty return", "Other"],
};


export default function InventoryPage({ selectedStoreId, stores }: InventoryPageProps) {
  const [activeTab, setActiveTab] = useState<"adjust" | "history" | "lowstock">("adjust");

  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{
    _id: Id<"products">; name: string; quantity: number; category: string;
  } | null>(null);
  const [adjustType, setAdjustType] = useState<"add" | "remove" | "set" | "damage" | "return">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [showThresholdSlider, setShowThresholdSlider] = useState(false);

  const adjustMutation = useMutation(api.inventory.adjust);
  const history = useQuery(api.inventory.list, {
    storeId: selectedStoreId ?? undefined,
    limit: 200,
  });
  const lowStock = useQuery(api.inventory.getLowStock, {
    storeId: selectedStoreId ?? undefined,
    threshold: lowStockThreshold,
  });

  // Product search — only fires when user types
  const hasSearch = search.trim().length >= 2;
  const searchResults = useQuery(
    api.products.search,
    hasSearch ? { query: search } : "skip"
  );

  const handleAdjust = async () => {
    if (!selectedProduct) return toast.error("Please select a product.");
    if (!selectedStoreId) return toast.error("Please select a store first.");
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) return toast.error("Enter a valid quantity.");
    if (!reason) return toast.error("Please select a reason.");

    setSubmitting(true);
    try {
      const result = await adjustMutation({
        storeId: selectedStoreId,
        productId: selectedProduct._id,
        type: adjustType,
        quantityChange: qty,
        reason,
        notes: notes || undefined,
      });
      toast.success(
        `Stock updated: ${result.quantityBefore} → ${result.quantityAfter} units`
      );
      setSelectedProduct(null);
      setQuantity("");
      setReason("");
      setNotes("");
      setSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportInventory = () => {
    if (!lowStock || !history) return toast.error("Data not ready yet.");

    const dateStr = new Date().toISOString().slice(0, 10);
    const storeName = selectedStoreId
      ? stores.find((s) => s._id === selectedStoreId)?.name ?? "Store"
      : "All Stores";

    // Sheet 1: Current stock snapshot (low-stock items)
    const stockRows = lowStock.map((p) => ({
      "Product Name": p.name,
      "Category": p.category,
      "Current Qty": p.quantity,
      "Status": p.quantity === 0 ? "Out of Stock" : p.quantity <= 3 ? "Critical" : p.quantity <= lowStockThreshold ? "Low" : "OK",
      "Store": storeName,
    }));

    // Sheet 2: Full adjustment history
    const historyRows = history.map((adj) => ({
      "Date": new Date(adj._creationTime).toLocaleDateString(),
      "Time": new Date(adj._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      "Product": adj.productName,
      "Type": adj.type.charAt(0).toUpperCase() + adj.type.slice(1),
      "Qty Before": adj.quantityBefore,
      "Change": adj.quantityAfter - adj.quantityBefore,
      "Qty After": adj.quantityAfter,
      "Reason": adj.reason,
      "Notes": adj.notes ?? "",
    }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(stockRows.length > 0 ? stockRows : [{ "Note": "No low-stock items at current threshold" }]);
    ws1["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Low Stock Snapshot");

    const ws2 = XLSX.utils.json_to_sheet(historyRows.length > 0 ? historyRows : [{ "Note": "No adjustment history" }]);
    ws2["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Adjustment History");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `inventory-${dateStr}.xlsx`);
    toast.success("Inventory exported successfully!");
  };

  const typeConfig = ADJUSTMENT_TYPES.find((t) => t.value === adjustType)!;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            Adjust stock levels, track changes, and monitor low-stock items
            {selectedStoreId
              ? ` — ${stores.find((s) => s._id === selectedStoreId)?.name}`
              : " — All Stores"}
          </p>
        </div>
        <button
          onClick={handleExportInventory}
          disabled={!lowStock || !history}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit flex-wrap">
        {[
          { id: "adjust", label: "Adjust Stock", icon: RefreshCw },
          { id: "history", label: "History", icon: History },
          { id: "lowstock", label: `Low Stock${lowStock ? ` (${lowStock.length})` : ""}`, icon: TrendingDown },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── ADJUST TAB ── */}
      {activeTab === "adjust" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Product selector + type */}
          <div className="space-y-4">
            {/* Product Search */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">1. Select Product</h2>
              {selectedProduct ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{selectedProduct.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedProduct.category} · Current stock:{" "}
                      <span className={`font-semibold ${selectedProduct.quantity <= 10 ? "text-red-600" : "text-green-600"}`}>
                        {selectedProduct.quantity}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedProduct(null); setSearch(""); }}
                    className="p-1.5 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowProductSearch(true); }}
                    onFocus={() => setShowProductSearch(true)}
                    placeholder="Search product name..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {showProductSearch && hasSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-56 overflow-y-auto">
                      {searchResults === undefined ? (
                        <div className="p-3 text-sm text-slate-400 text-center">Searching…</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-sm text-slate-400 text-center">No products found</div>
                      ) : (
                        searchResults.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => {
                              setSelectedProduct({ _id: p._id, name: p.name, quantity: p.quantity, category: p.category });
                              setShowProductSearch(false);
                              setSearch("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <p className="text-sm font-medium text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">
                              {p.category} · Stock: {p.quantity}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Adjustment Type */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">2. Adjustment Type</h2>
              <div className="grid grid-cols-1 gap-2">
                {ADJUSTMENT_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => { setAdjustType(t.value); setReason(""); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        adjustType === t.value
                          ? `${t.bg} ${t.color}`
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Quantity + Reason + Submit */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">3. Quantity & Reason</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    {adjustType === "set" ? "New Quantity" : "Quantity to " + typeConfig.label.split(" ")[0]}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {selectedProduct && quantity && adjustType !== "set" && (
                    <p className="text-xs text-slate-400 mt-1">
                      Result:{" "}
                      <span className="font-semibold text-slate-700">
                        {adjustType === "add" || adjustType === "return"
                          ? selectedProduct.quantity + parseFloat(quantity || "0")
                          : selectedProduct.quantity - parseFloat(quantity || "0")}{" "}
                        units
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason</label>
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select a reason…</option>
                      {REASONS[adjustType].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Notes <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Preview card */}
            {selectedProduct && quantity && reason && (
              <div className={`rounded-2xl border p-4 ${typeConfig.bg}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preview</p>
                <p className={`text-sm font-medium ${typeConfig.color}`}>
                  {typeConfig.label}: <strong>{quantity}</strong> units of{" "}
                  <strong>{selectedProduct.name}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-1">Reason: {reason}</p>
              </div>
            )}

            <button
              onClick={handleAdjust}
              disabled={submitting || !selectedProduct || !quantity || !reason || !selectedStoreId}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <TypeIcon className="w-4 h-4" />
              )}
              {submitting ? "Saving…" : "Apply Adjustment"}
            </button>

            {!selectedStoreId && (
              <p className="text-xs text-amber-600 text-center bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
                ⚠️ Select a store from the sidebar to apply adjustments
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Adjustment History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 100 adjustments</p>
          </div>
          {history === undefined ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No adjustments yet</p>
              <p className="text-slate-400 text-sm mt-1">Stock changes will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((adj) => {
                const t = ADJUSTMENT_TYPES.find((x) => x.value === adj.type)!;
                const Icon = t.icon;
                const isIncrease = adj.quantityAfter > adj.quantityBefore;
                return (
                  <div key={adj._id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${t.bg}`}>
                          <Icon className={`w-4 h-4 ${t.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{adj.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{adj.reason}</p>
                          {adj.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{adj.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${isIncrease ? "text-green-600" : "text-red-600"}`}>
                          {isIncrease ? "+" : ""}{adj.quantityAfter - adj.quantityBefore}
                        </p>
                        <p className="text-xs text-slate-400">
                          {adj.quantityBefore} → {adj.quantityAfter}
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          {new Date(adj._creationTime).toLocaleDateString()} {new Date(adj._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LOW STOCK TAB ── */}
      {activeTab === "lowstock" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Low Stock Alert</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Products with {lowStockThreshold} or fewer units
                </p>
              </div>
              <div className="flex items-center gap-3">
                {lowStock && lowStock.length > 0 && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                    {lowStock.length} items
                  </span>
                )}
                <button
                  onClick={() => setShowThresholdSlider((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    showThresholdSlider
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Threshold: {lowStockThreshold}
                </button>
              </div>
            </div>

            {/* Threshold slider */}
            {showThresholdSlider && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">
                    Alert when stock falls below:
                  </label>
                  <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {lowStockThreshold} units
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span>
                  <span>10</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            )}
          </div>
          {lowStock === undefined ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : lowStock.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-green-200 mx-auto mb-3" />
              <p className="text-green-600 font-medium">All products well stocked! 🎉</p>
              <p className="text-slate-400 text-sm mt-1">No items below 10 units</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.map((p) => (
                <div key={p._id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        p.quantity === 0
                          ? "bg-red-100 text-red-700"
                          : p.quantity <= 3
                          ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {p.quantity === 0 ? "Out of stock" : `${p.quantity} left`}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedProduct({ _id: p._id, name: p.name, quantity: p.quantity, category: p.category });
                        setAdjustType("add");
                        setActiveTab("adjust");
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Restock →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

