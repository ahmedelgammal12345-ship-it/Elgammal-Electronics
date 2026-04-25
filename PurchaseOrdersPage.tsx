import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Truck, Plus, Search, X, ChevronDown, Package, DollarSign,
  CheckCircle, Clock, AlertCircle, XCircle, Edit2, Trash2,
  ChevronRight, Eye, Download, Printer,
} from "lucide-react";
import jsPDF from "jspdf";

type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

interface POItem {
  productId: Id<"products">;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  total: number;
}

const STATUS_CONFIG: Record<POStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700", icon: Edit2 },
  ordered: { label: "Ordered", color: "bg-blue-100 text-blue-700", icon: Clock },
  partial: { label: "Partial", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  received: { label: "Received", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function PurchaseOrdersPage({ selectedStoreId, stores, isManager }: {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<POStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState<Id<"purchaseOrders"> | null>(null);
  const [showReceive, setShowReceive] = useState<Id<"purchaseOrders"> | null>(null);

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [notes, setNotes] = useState("");
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeStoreId, setActiveStoreId] = useState<Id<"stores"> | null>(selectedStoreId);

  // Receive form
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  const orders = useQuery(api.purchaseOrders.list, {
    storeId: selectedStoreId ?? undefined,
    status: statusFilter || undefined,
  });
  const stats = useQuery(api.purchaseOrders.getStats, { storeId: selectedStoreId ?? undefined });
  const selectedPOData = useQuery(api.purchaseOrders.get, selectedPO ? { poId: selectedPO } : "skip");
  const products = useQuery(
    api.products.search,
    productSearch.trim().length > 1 ? { query: productSearch } : "skip"
  );

  const createPO = useMutation(api.purchaseOrders.create);
  const updateStatus = useMutation(api.purchaseOrders.updateStatus);
  const receiveStock = useMutation(api.purchaseOrders.receiveStock);
  const removePO = useMutation(api.purchaseOrders.remove);

  const subtotal = poItems.reduce((s, i) => s + i.total, 0);
  const shipping = parseFloat(shippingCost) || 0;
  const totalCost = subtotal + shipping;

  const addItem = (product: any) => {
    if (poItems.find((i) => i.productId === product._id)) {
      toast.info("Product already in order");
      return;
    }
    setPoItems([...poItems, {
      productId: product._id,
      productName: product.name,
      orderedQty: 1,
      receivedQty: 0,
      unitCost: product.dealerPrice,
      total: product.dealerPrice,
    }]);
    setProductSearch("");
  };

  const updateItem = (idx: number, field: "orderedQty" | "unitCost", val: number) => {
    setPoItems(poItems.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      updated.total = updated.orderedQty * updated.unitCost;
      return updated;
    }));
  };

  const removeItem = (idx: number) => setPoItems(poItems.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent, status: POStatus) => {
    e.preventDefault();
    if (!supplierName.trim()) { toast.error("Supplier name is required"); return; }
    if (poItems.length === 0) { toast.error("Add at least one product"); return; }
    const storeId = activeStoreId ?? stores[0]?._id;
    if (!storeId) { toast.error("Select a store"); return; }
    try {
      await createPO({
        storeId,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        supplierEmail: supplierEmail.trim() || undefined,
        items: poItems,
        subtotal,
        shippingCost: shipping || undefined,
        totalCost,
        notes: notes.trim() || undefined,
        expectedDate: expectedDate || undefined,
        status,
      });
      toast.success(`Purchase order ${status === "draft" ? "saved as draft" : "placed"}`);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create PO");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSupplierName(""); setSupplierPhone(""); setSupplierEmail("");
    setExpectedDate(""); setShippingCost(""); setNotes("");
    setPoItems([]); setProductSearch("");
  };

  const handleReceive = async () => {
    if (!showReceive) return;
    const items = Object.entries(receiveQtys)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([productId, qty]) => ({ productId: productId as Id<"products">, receivedQty: parseFloat(qty) }));
    if (items.length === 0) { toast.error("Enter quantities to receive"); return; }
    try {
      await receiveStock({ poId: showReceive, receivedItems: items });
      toast.success("Stock received and inventory updated");
      setShowReceive(null);
      setReceiveQtys({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to receive stock");
    }
  };

  const handleDelete = async (id: Id<"purchaseOrders">) => {
    if (!confirm("Delete this purchase order?")) return;
    try {
      await removePO({ poId: id });
      toast.success("Purchase order deleted");
      if (selectedPO === id) setSelectedPO(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const exportPDF = (po: any, store: any) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", pageW / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(store?.name ?? "POS System", pageW / 2, y, { align: "center" });
    y += 5;
    if (store?.address) { doc.setFontSize(9); doc.text(store.address, pageW / 2, y, { align: "center" }); y += 4; }
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`PO Number: ${po.poNumber}`, 15, y);
    doc.text(`Date: ${new Date(po._creationTime).toLocaleDateString()}`, pageW - 15, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${po.status.toUpperCase()}`, 15, y);
    if (po.expectedDate) doc.text(`Expected: ${po.expectedDate}`, pageW - 15, y, { align: "right" });
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Supplier:", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(po.supplierName, 15, y); y += 5;
    if (po.supplierPhone) { doc.text(`Phone: ${po.supplierPhone}`, 15, y); y += 5; }
    if (po.supplierEmail) { doc.text(`Email: ${po.supplierEmail}`, 15, y); y += 5; }
    y += 5;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pageW - 30, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Product", 17, y + 5);
    doc.text("Ordered", pageW - 80, y + 5, { align: "right" });
    doc.text("Received", pageW - 55, y + 5, { align: "right" });
    doc.text("Unit Cost", pageW - 30, y + 5, { align: "right" });
    doc.text("Total", pageW - 15, y + 5, { align: "right" });
    y += 9;

    doc.setFont("helvetica", "normal");
    for (const item of po.items) {
      doc.text(item.productName.substring(0, 40), 17, y);
      doc.text(String(item.orderedQty), pageW - 80, y, { align: "right" });
      doc.text(String(item.receivedQty), pageW - 55, y, { align: "right" });
      doc.text(`ج.م${item.unitCost.toFixed(2)}`, pageW - 30, y, { align: "right" });
      doc.text(`ج.م${item.total.toFixed(2)}`, pageW - 15, y, { align: "right" });
      y += 6;
      if (y > 260) { doc.addPage(); y = 20; }
    }

    y += 4;
    doc.line(15, y, pageW - 15, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Subtotal:", pageW - 50, y, { align: "right" });
    doc.text(`EGP ${po.subtotal.toFixed(2)}`, pageW - 15, y, { align: "right" });
    y += 6;
    if (po.shippingCost) {
      doc.setFont("helvetica", "normal");
      doc.text("Shipping:", pageW - 50, y, { align: "right" });
      doc.text(`EGP ${po.shippingCost.toFixed(2)}`, pageW - 15, y, { align: "right" });
      y += 6;
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", pageW - 50, y, { align: "right" });
    doc.text(`EGP ${po.totalCost.toFixed(2)}`, pageW - 15, y, { align: "right" });


    doc.save(`${po.poNumber}.pdf`);
  };

  return (
    <div className="flex h-full">
      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Purchase Orders</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage supplier orders and stock receiving</p>
            </div>
            {isManager && (
              <button
                onClick={() => { setShowForm(true); setActiveStoreId(selectedStoreId); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New PO
              </button>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "Draft", value: stats.draft, color: "slate" },
                { label: "Ordered", value: stats.ordered, color: "blue" },
                { label: "Partial", value: stats.partial, color: "amber" },
                { label: "Received", value: stats.received, color: "emerald" },
                { label: "Total Value", value: `ج.م${stats.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "purple" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className="text-lg font-bold text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status:</span>
          {(["", "draft", "ordered", "partial", "received", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* PO List */}
        <div className="flex-1 overflow-auto p-6">
          {orders === undefined ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No purchase orders</h3>
              <p className="text-sm text-slate-400">Create your first PO to start receiving stock</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((po) => {
                const store = stores.find((s) => s._id === po.storeId);
                return (
                  <div
                    key={po._id}
                    onClick={() => setSelectedPO(selectedPO === po._id ? null : po._id)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedPO === po._id ? "border-blue-400 shadow-md ring-1 ring-blue-200" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Truck className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm font-mono">{po.poNumber}</span>
                            <StatusBadge status={po.status as POStatus} />
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{po.supplierName}</p>
                          <p className="text-xs text-slate-400">{store?.name} · {po.items.length} items · {new Date(po._creationTime).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-slate-900">ج.م{po.totalCost.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">total cost</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {(po.status === "ordered" || po.status === "partial") && isManager && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowReceive(po._id);
                                setReceiveQtys({});
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200"
                            >
                              Receive
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); exportPDF(po, store); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Export PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isManager && po.status !== "received" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(po._id); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedPO === po._id ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded items */}
                    {selectedPO === po._id && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-4 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-100 mb-2">
                          <span className="col-span-2">Product</span>
                          <span className="text-center">Ordered / Received</span>
                          <span className="text-right">Cost</span>
                        </div>
                        <div className="space-y-1.5">
                          {po.items.map((item, i) => (
                            <div key={i} className="grid grid-cols-4 text-sm items-center">
                              <span className="col-span-2 text-slate-700 truncate">{item.productName}</span>
                              <span className="text-center text-slate-500">
                                <span className="font-semibold text-slate-800">{item.receivedQty}</span>
                                <span className="text-slate-400"> / {item.orderedQty}</span>
                              </span>
                              <span className="text-right font-semibold text-slate-800">ج.م{item.total.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <div className="flex gap-2">
                            {po.status === "draft" && isManager && (
                              <button
                                onClick={(e) => { e.stopPropagation(); updateStatus({ poId: po._id, status: "ordered" }).then(() => toast.success("PO marked as ordered")); }}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                Mark as Ordered
                              </button>
                            )}
                          </div>
                          <div className="text-right">
                            {po.shippingCost && <p className="text-xs text-slate-500">Shipping: ج.م{po.shippingCost.toFixed(2)}</p>}
                            <p className="text-sm font-bold text-slate-900">Total: ج.م{po.totalCost.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New PO Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-bold text-slate-900">New Purchase Order</h2>
              </div>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-5">
              {/* Store */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Store *</label>
                <select
                  value={activeStoreId ?? ""}
                  onChange={(e) => setActiveStoreId(e.target.value as Id<"stores"> || null)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select store</option>
                  {stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>

              {/* Supplier */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Supplier Name *</label>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier Co." className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                  <input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="+1 555 0000" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} placeholder="supplier@email.com" type="email" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Expected Date</label>
                  <input value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} type="date" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Shipping Cost (ج.م)</label>
                  <input value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Product Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Add Products</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products to add..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {products && products.length > 0 && productSearch.trim().length > 1 && (
                  <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-auto z-10">
                    {products.map((p: any) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => addItem(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span className="text-slate-800">{p.name}</span>
                        <span className="text-xs text-slate-400">Cost: ج.م{p.dealerPrice.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              {poItems.length > 0 && (
                <div>
                  <div className="grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-100 mb-2">
                    <span className="col-span-5">Product</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-3 text-center">Unit Cost</span>
                    <span className="col-span-1 text-right">Total</span>
                    <span className="col-span-1" />
                  </div>
                  <div className="space-y-2">
                    {poItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 items-center gap-1">
                        <span className="col-span-5 text-sm text-slate-700 truncate">{item.productName}</span>
                        <input
                          type="number"
                          min="1"
                          value={item.orderedQty}
                          onChange={(e) => updateItem(i, "orderedQty", parseInt(e.target.value) || 1)}
                          className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateItem(i, "unitCost", parseFloat(e.target.value) || 0)}
                          className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="col-span-1 text-right text-sm font-semibold text-slate-800">ج.م{item.total.toFixed(2)}</span>
                        <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex justify-end text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-right">
                    <p className="text-sm text-slate-500">Subtotal: <span className="font-semibold text-slate-800">ج.م{subtotal.toFixed(2)}</span></p>
                    {shipping > 0 && <p className="text-sm text-slate-500">Shipping: <span className="font-semibold text-slate-800">ج.م{shipping.toFixed(2)}</span></p>}
                    <p className="text-base font-bold text-slate-900">Total: ج.م{totalCost.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..." className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as any, "draft")} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-600 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
                Save Draft
              </button>
              <button type="button" onClick={(e) => handleSubmit(e as any, "ordered")} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      {showReceive && selectedPOData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Package className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Receive Stock</h2>
                  <p className="text-xs text-slate-400">{selectedPOData.poNumber} · {selectedPOData.supplierName}</p>
                </div>
              </div>
              <button onClick={() => { setShowReceive(null); setReceiveQtys({}); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-500">Enter the quantity received for each product. Stock will be added to inventory automatically.</p>
              <div className="space-y-3">
                {selectedPOData.items.map((item) => {
                  const remaining = item.orderedQty - item.receivedQty;
                  return (
                    <div key={item.productId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                        <p className="text-xs text-slate-400">Ordered: {item.orderedQty} · Received: {item.receivedQty} · Remaining: {remaining}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receiveQtys[item.productId] ?? ""}
                        onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.productId]: e.target.value })}
                        placeholder="0"
                        disabled={remaining <= 0}
                        className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => { setShowReceive(null); setReceiveQtys({}); }} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleReceive} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
