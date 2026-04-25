import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Warehouse, Plus, Pencil, Trash2, X, Check, Phone,
  MapPin, User, Store, Package, ArrowRightLeft,
  ToggleLeft, ToggleRight, Search, ChevronDown, ChevronRight,
  AlertTriangle, Hash, Upload, FileSpreadsheet, Download,
  RefreshCw, CheckCircle, AlertCircle, Loader2, Info, ArrowRight,
} from "lucide-react";

interface WarehousesPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

interface WarehouseForm {
  name: string;
  code: string;
  address: string;
  phone: string;
  managerName: string;
  notes: string;
  storeId: string;
  isActive: boolean;
}

const emptyForm: WarehouseForm = {
  name: "", code: "", address: "", phone: "",
  managerName: "", notes: "", storeId: "", isActive: true,
};

type TabType = "warehouses" | "transfers" | "import";

// ─── Import types ─────────────────────────────────────────────────────────────

interface RawRow {
  [key: string]: string | number | undefined;
}

interface ImportColumnMapping {
  warehouse: string;
  productName: string;
  barcode: string;
  quantity: string;
  minQuantity: string;
}

interface ImportRow {
  warehouseName: string;
  warehouseId: Id<"warehouses"> | null;
  productName: string;
  productId: Id<"products"> | null;
  barcode: string;
  quantity: number;
  minQuantity: number | undefined;
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
}

type ImportStep = "upload" | "map" | "preview" | "importing" | "done";

const COLUMN_ALIASES: Record<keyof ImportColumnMapping, string[]> = {
  warehouse: ["warehouse", "warehouse name", "location", "wh", "المخزن", "المستودع"],
  productName: ["product name", "product", "name", "item", "item name", "اسم المنتج", "المنتج"],
  barcode: ["barcode", "sku", "code", "bar code", "الباركود", "الكود"],
  quantity: ["quantity", "qty", "stock", "amount", "الكمية", "المخزون"],
  minQuantity: ["min quantity", "min qty", "minimum", "reorder point", "الحد الأدنى", "أدنى كمية"],
};

const FIELD_LABELS: Record<keyof ImportColumnMapping, string> = {
  warehouse: "Warehouse *",
  productName: "Product Name *",
  barcode: "Barcode (optional)",
  quantity: "Quantity *",
  minQuantity: "Min Quantity (optional)",
};

const REQUIRED_IMPORT_FIELDS: (keyof ImportColumnMapping)[] = ["warehouse", "productName", "quantity"];

function autoDetectColumns(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {
    warehouse: "", productName: "", barcode: "", quantity: "", minQuantity: "",
  };
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (!mapping[field as keyof ImportColumnMapping] && aliases.some((a) => h.includes(a))) {
        mapping[field as keyof ImportColumnMapping] = header;
      }
    }
  }
  return mapping;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WarehousesPage({ selectedStoreId, stores, isManager }: WarehousesPageProps) {
  const [tab, setTab] = useState<TabType>("warehouses");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"warehouses"> | null>(null);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"warehouses"> | null>(null);
  const [expandedWarehouse, setExpandedWarehouse] = useState<Id<"warehouses"> | null>(null);

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    productSearch: "",
    productId: "",
    productName: "",
    quantity: 1,
    notes: "",
  });

  const warehouses = useQuery(api.warehouses.list, {
    storeId: selectedStoreId ?? undefined,
    activeOnly: showInactive ? false : true,
  });
  const allWarehouses = useQuery(api.warehouses.list, {});

  const transfers = useQuery(api.warehouses.listTransfers, { limit: 50 });

  const createWarehouse = useMutation(api.warehouses.create);
  const updateWarehouse = useMutation(api.warehouses.update);
  const removeWarehouse = useMutation(api.warehouses.remove);
  const createTransfer = useMutation(api.warehouses.createTransfer);

  const productResults = useQuery(
    api.products.search,
    transferForm.productSearch.length >= 2
      ? { query: transferForm.productSearch }
      : "skip"
  );

  const filtered = (warehouses ?? []).filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (w.managerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, storeId: selectedStoreId ?? "" });
    setShowForm(true);
  };

  const openEdit = (w: any) => {
    setEditId(w._id);
    setForm({
      name: w.name,
      code: w.code ?? "",
      address: w.address ?? "",
      phone: w.phone ?? "",
      managerName: w.managerName ?? "",
      notes: w.notes ?? "",
      storeId: w.storeId ?? "",
      isActive: w.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Warehouse name is required"); return; }
    try {
      if (editId) {
        await updateWarehouse({
          warehouseId: editId,
          name: form.name,
          code: form.code || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          managerName: form.managerName || undefined,
          notes: form.notes || undefined,
          storeId: form.storeId ? (form.storeId as Id<"stores">) : undefined,
          isActive: form.isActive,
        });
        toast.success("Warehouse updated!");
      } else {
        await createWarehouse({
          name: form.name,
          code: form.code || undefined,
          address: form.address || undefined,
          phone: form.phone || undefined,
          managerName: form.managerName || undefined,
          notes: form.notes || undefined,
          storeId: form.storeId ? (form.storeId as Id<"stores">) : undefined,
        });
        toast.success("Warehouse created!");
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleDelete = async (id: Id<"warehouses">) => {
    try {
      await removeWarehouse({ warehouseId: id });
      toast.success("Warehouse removed");
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove warehouse");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.productId) { toast.error("Please select a product"); return; }
    if (!transferForm.fromWarehouseId && !transferForm.toWarehouseId) {
      toast.error("Please select at least a source or destination warehouse");
      return;
    }
    if (transferForm.quantity <= 0) { toast.error("Quantity must be greater than 0"); return; }
    try {
      await createTransfer({
        fromWarehouseId: transferForm.fromWarehouseId
          ? (transferForm.fromWarehouseId as Id<"warehouses">)
          : undefined,
        toWarehouseId: transferForm.toWarehouseId
          ? (transferForm.toWarehouseId as Id<"warehouses">)
          : undefined,
        productId: transferForm.productId as Id<"products">,
        quantity: transferForm.quantity,
        notes: transferForm.notes || undefined,
      });
      toast.success("Transfer completed!");
      setShowTransferForm(false);
      setTransferForm({
        fromWarehouseId: "", toWarehouseId: "",
        productSearch: "", productId: "", productName: "",
        quantity: 1, notes: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    }
  };

  const storeName = (storeId?: string) =>
    stores.find((s) => s._id === storeId)?.name ?? "—";

  const warehouseName = (id?: string) =>
    (warehouses ?? []).find((w) => w._id === id)?.name ?? "—";

  const warehouseColors = [
    "from-blue-500 to-blue-700",
    "from-violet-500 to-purple-700",
    "from-emerald-500 to-teal-700",
    "from-orange-500 to-amber-700",
    "from-rose-500 to-pink-700",
    "from-cyan-500 to-sky-700",
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Warehouse className="w-5 h-5 text-white" />
            </div>
            Warehouses
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-13">
            {(warehouses ?? []).length} warehouse{(warehouses ?? []).length !== 1 ? "s" : ""} · Manage stock locations & transfers
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowTransferForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
              New Transfer
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["warehouses", "transfers", "import"] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "warehouses"
              ? `Warehouses (${(warehouses ?? []).length})`
              : t === "transfers"
              ? "Transfer History"
              : "📥 Import Stock"}
          </button>
        ))}
      </div>

      {/* ── WAREHOUSES TAB ── */}
      {tab === "warehouses" && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search warehouses…"
                className="pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white w-56"
              />
            </div>
            <button
              onClick={() => setShowInactive((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                showInactive
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {showInactive ? "Showing All" : "Active Only"}
            </button>
          </div>

          {/* Warehouse Cards */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Warehouse className="w-8 h-8 text-blue-300" />
              </div>
              <p className="font-semibold text-slate-600 text-lg">No warehouses yet</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                {isManager ? "Click \"Add Warehouse\" to create your first warehouse" : "No warehouses have been set up yet"}
              </p>
              {isManager && (
                <button
                  onClick={openCreate}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  Add First Warehouse
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((w, idx) => {
                const colorClass = warehouseColors[idx % warehouseColors.length];
                const isExpanded = expandedWarehouse === w._id;
                return (
                  <div
                    key={w._id}
                    className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden ${
                      w.isActive ? "border-slate-100 hover:shadow-md" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                            <Warehouse className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-base">{w.name}</h3>
                              {w.code && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-mono font-medium">
                                  {w.code}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                w.isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {w.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {w.address && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{w.address}</span>
                                </div>
                              )}
                              {w.phone && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span>{w.phone}</span>
                                </div>
                              )}
                              {w.managerName && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  <span>{w.managerName}</span>
                                </div>
                              )}
                              {w.storeId && (
                                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                                  <Store className="w-3 h-3 flex-shrink-0" />
                                  <span>{storeName(w.storeId)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => openEdit(w)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(w._id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {w.notes && (
                        <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 italic">
                          {w.notes}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedWarehouse(isExpanded ? null : w._id)}
                      className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        View Stock
                      </span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <WarehouseStockPanel warehouseId={w._id} isManager={isManager} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TRANSFERS TAB ── */}
      {tab === "transfers" && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-b from-emerald-50 to-emerald-100/50 border-b border-emerald-100">
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">From</th>
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">To</th>
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-emerald-700 text-xs uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(transfers ?? []).map((t) => (
                  <tr key={t._id} className="hover:bg-emerald-50/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{t.productName}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {t.fromWarehouseId ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Warehouse className="w-3 h-3 text-slate-400" />
                          {warehouseName(t.fromWarehouseId)}
                        </span>
                      ) : t.fromStoreId ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Store className="w-3 h-3 text-slate-400" />
                          {storeName(t.fromStoreId)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {t.toWarehouseId ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Warehouse className="w-3 h-3 text-slate-400" />
                          {warehouseName(t.toWarehouseId)}
                        </span>
                      ) : t.toStoreId ? (
                        <span className="flex items-center gap-1 text-xs">
                          <Store className="w-3 h-3 text-slate-400" />
                          {storeName(t.toStoreId)}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900">{t.quantity}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                        t.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "completed" ? "bg-emerald-500"
                          : t.status === "pending" ? "bg-amber-500"
                          : "bg-red-500"
                        }`} />
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {new Date(t._creationTime).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(transfers ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No transfers yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {tab === "import" && (
        <StockImportPanel
          warehouses={allWarehouses ?? []}
          isManager={isManager}
        />
      )}

      {/* ── ADD / EDIT WAREHOUSE MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Warehouse className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editId ? "Edit Warehouse" : "Add Warehouse"}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Warehouse Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Main Warehouse"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                    autoFocus
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Code / Short Name
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="e.g. WH-01"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="e.g. Industrial Zone, Cairo"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="01012345678"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Manager
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={form.managerName}
                      onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                      placeholder="Manager name"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Linked Store (optional)
                </label>
                <select
                  value={form.storeId}
                  onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
                >
                  <option value="">No specific store (Central)</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                />
              </div>

              {editId && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">Active Status</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      form.isActive
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {form.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {form.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {editId ? "Save Changes" : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TRANSFER MODAL ── */}
      {showTransferForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">New Stock Transfer</h2>
              </div>
              <button
                onClick={() => setShowTransferForm(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  From Warehouse
                </label>
                <select
                  value={transferForm.fromWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none bg-white"
                >
                  <option value="">— Select source —</option>
                  {(warehouses ?? []).filter((w) => w.isActive).map((w) => (
                    <option key={w._id} value={w._id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  To Warehouse
                </label>
                <select
                  value={transferForm.toWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none bg-white"
                >
                  <option value="">— Select destination —</option>
                  {(warehouses ?? []).filter((w) => w.isActive && w._id !== transferForm.fromWarehouseId).map((w) => (
                    <option key={w._id} value={w._id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Product <span className="text-red-500">*</span>
                </label>
                {transferForm.productId ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <Package className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-emerald-800 flex-1">{transferForm.productName}</span>
                    <button
                      type="button"
                      onClick={() => setTransferForm({ ...transferForm, productId: "", productName: "", productSearch: "" })}
                      className="text-emerald-500 hover:text-emerald-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={transferForm.productSearch}
                      onChange={(e) => setTransferForm({ ...transferForm, productSearch: e.target.value })}
                      placeholder="Search product name…"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                    />
                    {productResults && productResults.length > 0 && transferForm.productSearch.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                        {productResults.slice(0, 8).map((p) => (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => setTransferForm({
                              ...transferForm,
                              productId: p._id,
                              productName: p.name,
                              productSearch: "",
                            })}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span className="text-slate-400 text-xs ml-2">{p.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Notes
                </label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder="Optional reason or notes…"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Transfer Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Warehouse?</h3>
            <p className="text-slate-500 text-sm mb-6">
              This will permanently delete this warehouse. Warehouses with stock records cannot be deleted — deactivate them instead.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Stock panel per warehouse ──────────────────────────────────
function WarehouseStockPanel({
  warehouseId,
  isManager,
}: {
  warehouseId: Id<"warehouses">;
  isManager: boolean;
}) {
  const stock = useQuery(api.warehouses.getStock, { warehouseId });
  const adjustStock = useMutation(api.warehouses.adjustStock);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newQty, setNewQty] = useState(0);

  const handleSaveQty = async (productId: Id<"products">, minQty?: number) => {
    try {
      await adjustStock({ warehouseId, productId, quantity: newQty, minQuantity: minQty });
      toast.success("Stock updated");
      setEditingStock(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    }
  };

  if (stock === undefined) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (stock.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        <Package className="w-6 h-6 mx-auto mb-2 opacity-30" />
        No stock records yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {stock.map((s) => (
        <div key={s._id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50/50">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{s.productName}</p>
            {s.minQuantity !== undefined && s.quantity <= s.minQuantity && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Low stock
              </span>
            )}
          </div>
          {editingStock === s._id ? (
            <div className="flex items-center gap-2 ml-3">
              <input
                type="number"
                min={0}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => handleSaveQty(s.productId, s.minQuantity)}
                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => setEditingStock(null)}
                className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                s.minQuantity !== undefined && s.quantity <= s.minQuantity
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700"
              }`}>
                {s.quantity} units
              </span>
              {isManager && (
                <button
                  onClick={() => { setEditingStock(s._id); setNewQty(s.quantity); }}
                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sub-component: Stock Import Panel ─────────────────────────────────────────
function StockImportPanel({
  warehouses,
  isManager,
}: {
  warehouses: Array<{ _id: Id<"warehouses">; name: string; code?: string; isActive: boolean }>;
  isManager: boolean;
}) {
  const bulkAdjustStock = useMutation(api.warehouses.bulkAdjustStock);

  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportColumnMapping>({
    warehouse: "", productName: "", barcode: "", quantity: "", minQuantity: "",
  });
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; skipped: number; errors: string[];
  } | null>(null);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ──
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Warehouse", "Product Name", "Barcode", "Quantity", "Min Quantity"],
      ["Main Warehouse", "Product A", "123456789", "100", "10"],
      ["Main Warehouse", "Product B", "", "50", "5"],
      ["Branch Warehouse", "Product C", "987654321", "200", "20"],
    ]);
    ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Import");
    XLSX.writeFile(wb, "warehouse_stock_template.xlsx");
  };

  // ── File upload ──
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) { toast.error("The file appears to be empty"); return; }
        const hdrs = Object.keys(rows[0]);
        setRawRows(rows);
        setHeaders(hdrs);
        setMapping(autoDetectColumns(hdrs));
        setStep("map");
      } catch {
        toast.error("Could not read the file. Please use Excel (.xlsx) or CSV format.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Build preview rows ──
  const buildPreview = useCallback(() => {
    const rows: ImportRow[] = rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Warehouse resolution
      const whName = mapping.warehouse
        ? String(raw[mapping.warehouse] ?? "").trim()
        : "";
      let warehouseId: Id<"warehouses"> | null = null;

      if (whName) {
        const match = warehouses.find(
          (w) => w.name.toLowerCase() === whName.toLowerCase() ||
                 (w.code ?? "").toLowerCase() === whName.toLowerCase()
        );
        if (match) {
          warehouseId = match._id;
        } else {
          errors.push(`Warehouse "${whName}" not found`);
        }
      } else if (defaultWarehouseId) {
        warehouseId = defaultWarehouseId as Id<"warehouses">;
      } else {
        errors.push("No warehouse specified");
      }

      // Product name
      const productName = mapping.productName
        ? String(raw[mapping.productName] ?? "").trim()
        : "";
      if (!productName) errors.push("Product name is required");

      // Barcode
      const barcode = mapping.barcode
        ? String(raw[mapping.barcode] ?? "").trim()
        : "";

      // Quantity
      const qtyRaw = mapping.quantity ? raw[mapping.quantity] : undefined;
      const quantity = qtyRaw !== undefined && qtyRaw !== "" ? Number(qtyRaw) : NaN;
      if (isNaN(quantity)) errors.push("Quantity must be a number");
      else if (quantity < 0) errors.push("Quantity cannot be negative");

      // Min quantity
      const minQtyRaw = mapping.minQuantity ? raw[mapping.minQuantity] : undefined;
      const minQuantity =
        minQtyRaw !== undefined && minQtyRaw !== "" ? Number(minQtyRaw) : undefined;
      if (minQuantity !== undefined && isNaN(minQuantity)) {
        warnings.push("Min quantity is not a valid number — will be ignored");
      }

      if (!productName && !barcode) {
        errors.push("Either product name or barcode is required to identify the product");
      }

      return {
        warehouseName: whName || (defaultWarehouseId
          ? warehouses.find((w) => w._id === defaultWarehouseId)?.name ?? ""
          : ""),
        warehouseId,
        productName,
        productId: null, // resolved at import time
        barcode,
        quantity: isNaN(quantity) ? 0 : quantity,
        minQuantity: minQuantity !== undefined && !isNaN(minQuantity) ? minQuantity : undefined,
        _rowIndex: idx + 2,
        _errors: errors,
        _warnings: warnings,
      };
    });
    setPreviewRows(rows);
    setStep("preview");
  }, [rawRows, mapping, warehouses, defaultWarehouseId]);

  // ── Run import ──
  const runImport = async () => {
    const validRows = previewRows.filter((r) => r._errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setStep("importing");
    setImportProgress(0);

    try {
      const items = validRows
        .filter((r) => r.warehouseId !== null)
        .map((r) => ({
          warehouseId: r.warehouseId!,
          productName: r.productName,
          barcode: r.barcode || undefined,
          quantity: r.quantity,
          minQuantity: r.minQuantity,
        }));

      setImportProgress(40);

      const result = await bulkAdjustStock({ items });

      setImportProgress(100);

      const skipped = validRows.length - items.length + (result?.errors?.length ?? 0);
      setImportResult({
        created: result?.created ?? 0,
        updated: result?.updated ?? 0,
        skipped,
        errors: result?.errors ?? [],
      });
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setRawRows([]);
    setHeaders([]);
    setMapping({ warehouse: "", productName: "", barcode: "", quantity: "", minQuantity: "" });
    setPreviewRows([]);
    setImportProgress(0);
    setImportResult(null);
    setDefaultWarehouseId("");
  };

  const validCount = previewRows.filter((r) => r._errors.length === 0).length;
  const errorCount = previewRows.filter((r) => r._errors.length > 0).length;
  const warnCount = previewRows.filter((r) => r._warnings.length > 0 && r._errors.length === 0).length;

  if (!isManager) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="font-semibold text-slate-600">Manager access required</p>
        <p className="text-slate-400 text-sm mt-1">Only managers can import stock data</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["upload", "map", "preview", "importing", "done"] as ImportStep[]).map((s, idx) => {
          const stepIdx = ["upload", "map", "preview", "importing", "done"].indexOf(step);
          const thisIdx = idx;
          const isDone = thisIdx < stepIdx;
          const isCurrent = thisIdx === stepIdx;
          const labels = ["Upload", "Map Columns", "Preview", "Importing", "Done"];
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isCurrent
                  ? "bg-blue-600 text-white"
                  : isDone
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}>
                {isDone ? <CheckCircle className="w-3 h-3" /> : <span>{idx + 1}</span>}
                {labels[idx]}
              </div>
              {idx < 4 && <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP 1: UPLOAD ── */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-1">How to import warehouse stock</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                <li>Download the template below and fill in your stock data</li>
                <li>Each row = one product in one warehouse</li>
                <li>Product names must match exactly what's in your product catalog</li>
                <li>Upload the file and map the columns</li>
              </ol>
            </div>
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Download Template</p>
                <p className="text-xs text-slate-500">Excel template with sample data and correct column headers</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-12 text-center cursor-pointer transition-all hover:bg-blue-50/30 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mx-auto mb-4 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </div>
            <p className="text-base font-semibold text-slate-700 mb-1">
              Drop your Excel or CSV file here
            </p>
            <p className="text-sm text-slate-400">or click to browse files</p>
            <p className="text-xs text-slate-300 mt-2">.xlsx, .xls, .csv supported</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          {/* Column format reference */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Expected Columns</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <div key={field} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    REQUIRED_IMPORT_FIELDS.includes(field as keyof ImportColumnMapping)
                      ? "bg-red-400"
                      : "bg-slate-300"
                  }`} />
                  <span className="text-slate-600">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />
              Required fields
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 2: MAP COLUMNS ── */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Map Your Columns</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  File: <span className="font-medium text-slate-700">{fileName}</span> · {rawRows.length} rows detected
                </p>
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Change file
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(FIELD_LABELS) as (keyof ImportColumnMapping)[]).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    {FIELD_LABELS[field]}
                    {REQUIRED_IMPORT_FIELDS.includes(field) && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none bg-white ${
                      REQUIRED_IMPORT_FIELDS.includes(field) && !mapping[field]
                        ? "border-red-300 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500"
                    }`}
                  >
                    <option value="">— Not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Default warehouse fallback */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Default Warehouse (used when Warehouse column is empty)
              </label>
              <select
                value={defaultWarehouseId}
                onChange={(e) => setDefaultWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
              >
                <option value="">— No default —</option>
                {warehouses.filter((w) => w.isActive).map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}{w.code ? ` (${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview of first 3 rows */}
            {rawRows.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Data Preview (first 3 rows)
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-50">
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-32 truncate">
                              {String(row[h] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={buildPreview}
              disabled={REQUIRED_IMPORT_FIELDS.some((f) => !mapping[f])}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Preview Import
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW ── */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{validCount}</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Ready to import</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${warnCount > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
              <p className={`text-2xl font-bold ${warnCount > 0 ? "text-amber-700" : "text-slate-400"}`}>{warnCount}</p>
              <p className={`text-xs font-medium mt-0.5 ${warnCount > 0 ? "text-amber-600" : "text-slate-400"}`}>With warnings</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${errorCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
              <p className={`text-2xl font-bold ${errorCount > 0 ? "text-red-700" : "text-slate-400"}`}>{errorCount}</p>
              <p className={`text-xs font-medium mt-0.5 ${errorCount > 0 ? "text-red-600" : "text-slate-400"}`}>Will be skipped</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                {previewRows.length} rows · showing all
              </p>
              <button
                onClick={() => setStep("map")}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Re-map columns
              </button>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="bg-gradient-to-b from-slate-50 to-slate-100/50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Row</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Warehouse</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Barcode</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Min Qty</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previewRows.map((row) => (
                    <tr
                      key={row._rowIndex}
                      className={`transition-colors ${
                        row._errors.length > 0
                          ? "bg-red-50/50"
                          : row._warnings.length > 0
                          ? "bg-amber-50/30"
                          : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{row._rowIndex}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${row.warehouseId ? "text-slate-700" : "text-red-600"}`}>
                          {row.warehouseName || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-48 truncate">
                        {row.productName || <span className="text-red-400 italic">missing</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono">
                        {row.barcode || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                        {row.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-500">
                        {row.minQuantity ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {row._errors.length > 0 ? (
                          <div className="space-y-0.5">
                            {row._errors.map((e, i) => (
                              <div key={i} className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                <span>{e}</span>
                              </div>
                            ))}
                          </div>
                        ) : row._warnings.length > 0 ? (
                          <div className="space-y-0.5">
                            {row._warnings.map((w, i) => (
                              <div key={i} className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="w-3 h-3" />
                            Ready
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("map")}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={runImport}
              disabled={validCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Import {validCount} Row{validCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: IMPORTING ── */}
      {step === "importing" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Importing Stock Data…</h3>
          <p className="text-slate-500 text-sm mb-6">Please wait while we update warehouse stock levels</p>
          <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{importProgress}%</p>
        </div>
      )}

      {/* ── STEP 5: DONE ── */}
      {step === "done" && importResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-1">Import Complete!</h3>
            <p className="text-slate-500 text-sm mb-6">Warehouse stock levels have been updated</p>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-emerald-700">{importResult.created}</p>
                <p className="text-xs text-emerald-600 font-medium">New records</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                <p className="text-xs text-blue-600 font-medium">Updated</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-slate-500">{importResult.skipped}</p>
                <p className="text-xs text-slate-400 font-medium">Skipped</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="text-left bg-red-50 border border-red-100 rounded-xl p-4 mb-4 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2 uppercase tracking-wide">
                  {importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}
                </p>
                {importResult.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 mb-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Another File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
