import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  FileText, Plus, Search, X, Check, Eye, Trash2, ArrowRight,
  User, Phone, Mail, SlidersHorizontal, Minus, Package, Printer, Filter
} from "lucide-react";
import QuotationReceiptModal from "./QuotationReceiptModal";

interface CartItem {
  productId: Id<"products">;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuotationsPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}

export default function QuotationsPage({ selectedStoreId, stores }: QuotationsPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<any | null>(null);
  const [printQuotation, setPrintQuotation] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [activeStoreId, setActiveStoreId] = useState<Id<"stores"> | null>(selectedStoreId);

  const quotations = useQuery(api.quotations.list, {
    storeId: selectedStoreId ?? undefined,
    status: filterStatus as any || undefined,
  });
  const hasProductFilter = productSearch.trim() !== "" || selectedCategory !== "";
  const searchedProducts = useQuery(
    api.products.search,
    hasProductFilter ? { query: productSearch, category: selectedCategory || undefined } : "skip"
  );
  const defaultProducts = useQuery(
    api.products.list,
    !hasProductFilter && showForm ? { limit: 60 } : "skip"
  );
  const products = hasProductFilter ? searchedProducts : defaultProducts;
  const categories = useQuery(api.products.getCategories);
  const createQuotation = useMutation(api.quotations.create);
  const updateStatus = useMutation(api.quotations.updateStatus);
  const convertToSale = useMutation(api.quotations.convertToSale);
  const removeQuotation = useMutation(api.quotations.remove);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) {
        return prev.map((i) => i.productId === product._id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i
        );
      }
      return [...prev, {
        productId: product._id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.userPrice,
        total: product.userPrice,
      }];
    });
  };

  const updateQty = (productId: Id<"products">, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.unitPrice } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const updatePrice = (productId: Id<"products">, price: number) => {
    setCart((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, unitPrice: price, total: i.quantity * price } : i)
    );
  };

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStoreId) { toast.error("Please select a store"); return; }
    if (!customerName) { toast.error("Customer name is required"); return; }
    if (cart.length === 0) { toast.error("Add at least one product"); return; }
    try {
      await createQuotation({
        storeId: activeStoreId,
        customerName,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        items: cart,
        subtotal,
        discount: discount > 0 ? discount : undefined,
        total,
        notes: notes || undefined,
        validUntil: validUntil || undefined,
      });
      toast.success("Quotation created!");
      setShowForm(false);
      setCart([]);
      setCustomerName(""); setCustomerPhone(""); setCustomerEmail("");
      setNotes(""); setValidUntil(""); setDiscount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create quotation");
    }
  };

  const handleConvert = async (quotationId: Id<"quotations">) => {
    if (!confirm("Convert this quotation to a sale?")) return;
    try {
      await convertToSale({ quotationId });
      toast.success("Converted to sale successfully!");
    } catch (e) {
      toast.error("Failed to convert quotation");
    }
  };

  const handleDelete = async (quotationId: Id<"quotations">) => {
    if (!confirm("Delete this quotation?")) return;
    try {
      await removeQuotation({ quotationId });
      toast.success("Quotation deleted");
    } catch (e) {
      toast.error("Failed to delete quotation");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-slate-100 text-slate-700",
      sent: "bg-blue-100 text-blue-700",
      accepted: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
    };
    return map[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotations</h1>
          <p className="text-slate-500 text-sm mt-0.5">{quotations?.length ?? 0} quotations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Quotation
        </button>
      </div>

      {/* Filter */}
      <div className="animate-fade-in-up stagger-1">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Number</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Items</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(quotations ?? []).map((q) => (
                <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{q.quotationNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{q.customerName}</p>
                    {q.customerPhone && <p className="text-xs text-slate-400">{q.customerPhone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{new Date(q._creationTime).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-600">{q.items.length} item(s)</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">ج.م{q.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={q.status}
                      onChange={(e) => updateStatus({ quotationId: q._id, status: e.target.value as any })}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer outline-none ${statusBadge(q.status)}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setViewQuotation(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setPrintQuotation(q)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Print Receipt">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {q.status !== "accepted" && (
                        <button onClick={() => handleConvert(q._id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Convert to Sale">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(q._id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {quotations?.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No quotations yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quotation Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">New Quotation</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Product Search */}
              <div className="w-1/2 border-r border-slate-100 flex flex-col overflow-hidden">
                <div className="p-4 space-y-3 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                  {/* Category pill filter */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Filter categories…"
                        className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      />
                      {categorySearch && (
                        <button
                          onClick={() => setCategorySearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
                      <div className="flex gap-1.5 flex-nowrap min-w-max">
                        <button
                          onClick={() => { setSelectedCategory(""); setCategorySearch(""); }}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                            !selectedCategory ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          All
                        </button>
                        {(categories ?? [])
                          .filter((cat) =>
                            categorySearch.trim() === "" ||
                            cat.toLowerCase().includes(categorySearch.toLowerCase())
                          )
                          .map((cat) => (
                            <button
                              key={cat}
                              onClick={() => { setSelectedCategory(cat === selectedCategory ? "" : cat); setCategorySearch(""); }}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                                selectedCategory === cat ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        {categorySearch.trim() !== "" &&
                          (categories ?? []).filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                            <span className="text-xs text-slate-400 py-1 px-2 italic">No match</span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-1">
                  {products === undefined ? (
                    <div className="py-10 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs">Loading products...</p>
                    </div>
                  ) : (products ?? []).length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">No products found</p>
                    </div>
                  ) : (
                    (products ?? []).map((p) => (
                      <button key={p._id} onClick={() => addToCart(p)} className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.category} {p.brand ? `· ${p.brand}` : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-600">ج.م{p.userPrice.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">Qty: {p.quantity}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Quotation Builder */}
              <form onSubmit={handleCreate} className="w-1/2 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Store */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Store</label>
                    <select
                      value={activeStoreId ?? ""}
                      onChange={(e) => setActiveStoreId(e.target.value as Id<"stores"> || null)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none"
                    >
                      <option value="">Select Store</option>
                      {stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* Customer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Customer Name *</label>
                      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
                      <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                      <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Valid Until</label>
                      <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" />
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items ({cart.length})</label>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {cart.map((item) => (
                        <div key={item.productId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">{item.productName}</p>
                          </div>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
                            className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded focus:border-blue-400 outline-none"
                            step="0.01"
                          />
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateQty(item.productId, -1)} className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                            <button type="button" onClick={() => updateQty(item.productId, 1)} className="w-5 h-5 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center">
                              <Plus className="w-2.5 h-2.5 text-blue-600" />
                            </button>
                          </div>
                          <span className="text-xs font-bold w-14 text-right">ج.م{item.total.toFixed(2)}</span>
                          <button type="button" onClick={() => setCart((p) => p.filter((i) => i.productId !== item.productId))} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {cart.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Click products on the left to add them</p>}
                    </div>
                  </div>

                  {/* Discount & Total */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 flex-1">Discount %</label>
                      <input type="number" value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className="w-16 px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-400 outline-none text-right" min="0" max="100" />
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                      <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>ج.م{subtotal.toFixed(2)}</span></div>
                      {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-ج.م{discountAmount.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1"><span>Total</span><span>ج.م{total.toFixed(2)}</span></div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none resize-none" />
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    Create Quotation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Quotation Modal */}
      {viewQuotation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewQuotation.quotationNumber}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(viewQuotation.status)}`}>{viewQuotation.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPrintQuotation(viewQuotation); setViewQuotation(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button onClick={() => setViewQuotation(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-400 text-xs">Customer</p><p className="font-medium">{viewQuotation.customerName}</p></div>
                {viewQuotation.customerPhone && <div><p className="text-slate-400 text-xs">Phone</p><p className="font-medium">{viewQuotation.customerPhone}</p></div>}
                {viewQuotation.customerEmail && <div><p className="text-slate-400 text-xs">Email</p><p className="font-medium">{viewQuotation.customerEmail}</p></div>}
                {viewQuotation.validUntil && <div><p className="text-slate-400 text-xs">Valid Until</p><p className="font-medium">{viewQuotation.validUntil}</p></div>}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Items</p>
                <div className="space-y-2">
                  {viewQuotation.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName} × {item.quantity} @ ج.م{item.unitPrice.toFixed(2)}</span>
                      <span className="font-medium">ج.م{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>ج.م{viewQuotation.subtotal.toFixed(2)}</span></div>
                {viewQuotation.discount && <div className="flex justify-between text-emerald-600"><span>Discount ({viewQuotation.discount}%)</span><span>-ج.م{((viewQuotation.subtotal * viewQuotation.discount) / 100).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-slate-900 text-base"><span>Total</span><span>ج.م{viewQuotation.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Quotation Receipt Modal */}
      {printQuotation && (
        <QuotationReceiptModal
          quotation={printQuotation}
          store={stores.find((s) => s._id === printQuotation.storeId) ?? null}
          onClose={() => setPrintQuotation(null)}
        />
      )}
    </div>
  );
}
