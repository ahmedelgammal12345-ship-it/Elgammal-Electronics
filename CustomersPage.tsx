import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Users, Plus, Search, X, Edit2, Trash2, Phone, Mail, MapPin,
  TrendingUp, ShoppingBag, Award, ChevronRight, History,
  DollarSign, Package, FileText, Clock, AlertCircle,
  CheckCircle2, Banknote,
} from "lucide-react";

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: CustomerFormData = { name: "", phone: "", email: "", address: "", notes: "" };

function LoyaltyBadge({ points, discount }: { points: number; discount: number }) {
  if (points >= 5000) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">Platinum {discount}%</span>;
  if (points >= 2500) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Gold {discount}%</span>;
  if (points >= 1000) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Silver {discount}%</span>;
  if (points >= 500) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Bronze {discount}%</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">New</span>;
}

// ── Pending Sale Card ──────────────────────────────────────────────────────
function PendingSaleCard({ sale, stores }: { sale: any; stores: Array<{ _id: Id<"stores">; name: string }> }) {
  const [showPayment, setShowPayment] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Array<{
    productId: Id<"products">; productName: string; quantity: number; unitPrice: number; total: number;
  }>>([]);

  const addPayment = useMutation(api.sales.addPayment);
  const addItems = useMutation(api.sales.addItems);
  const cancelSale = useMutation(api.sales.cancelPendingSale);

  const searchResults = useQuery(
    api.products.search,
    itemSearch.trim().length >= 2 ? { query: itemSearch } : "skip"
  );

  const remaining = sale.remainingBalance ?? 0;
  const paid = sale.amountPaid ?? 0;
  const pct = sale.total > 0 ? Math.min(100, (paid / sale.total) * 100) : 0;
  const storeName = stores.find((s) => s._id === sale.storeId)?.name ?? "—";

  const handlePayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) { toast.error("Enter a valid payment amount"); return; }
    try {
      const result = await addPayment({ saleId: sale._id, amount: amt, notes: paymentNotes || undefined });
      toast.success(result.isFullyPaid ? "Sale fully paid! ✅" : `Payment recorded. Remaining: ج.م${result.newRemaining.toFixed(2)}`);
      setShowPayment(false); setPaymentAmount(""); setPaymentNotes("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to record payment"); }
  };

  const addItemToList = (product: any) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) return prev.map((i) => i.productId === product._id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice } : i);
      return [...prev, { productId: product._id, productName: product.name, quantity: 1, unitPrice: product.userPrice, total: product.userPrice }];
    });
  };

  const handleAddItems = async () => {
    if (selectedItems.length === 0) { toast.error("Select at least one product"); return; }
    try {
      const result = await addItems({ saleId: sale._id, newItems: selectedItems });
      toast.success(`Items added! New total: ج.م${result.newTotal.toFixed(2)}`);
      setShowAddItems(false); setSelectedItems([]); setItemSearch("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add items"); }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this sale? Stock will be restored.")) return;
    try {
      await cancelSale({ saleId: sale._id, reason: "Cancelled by manager" });
      toast.success("Sale cancelled and stock restored");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to cancel"); }
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-800 font-mono">{sale.saleNumber ?? sale._id.slice(-8)}</span>
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">Pending</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{storeName}</p>
          <p className="text-xs text-slate-400">{new Date(sale._creationTime).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-emerald-600 font-semibold">Paid: ج.م{paid.toFixed(2)}</span>
          <span className="text-red-600 font-semibold">Due: ج.م{remaining.toFixed(2)}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
          <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mb-3">
          <span>{pct.toFixed(0)}% paid</span>
          <span className="font-semibold text-slate-700">Total: ج.م{sale.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Items summary */}
      <div className="px-4 pb-3">
        <p className="text-xs text-slate-500 mb-1.5 font-medium">{sale.items.length} item{sale.items.length !== 1 ? "s" : ""}</p>
        <div className="space-y-0.5">
          {sale.items.slice(0, 3).map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-xs text-slate-600">
              <span className="truncate flex-1">{item.productName} ×{item.quantity}</span>
              <span className="font-medium ml-2">ج.م{item.total.toFixed(2)}</span>
            </div>
          ))}
          {sale.items.length > 3 && <p className="text-xs text-slate-400 italic">+{sale.items.length - 3} more…</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-3 flex gap-2">
        <button onClick={() => { setShowPayment(!showPayment); setShowAddItems(false); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
          <Banknote className="w-3.5 h-3.5" /> Add Payment
        </button>
        <button onClick={() => { setShowAddItems(!showAddItems); setShowPayment(false); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
          <Package className="w-3.5 h-3.5" /> Add Items
        </button>
        <button onClick={handleCancel} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors border border-red-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add Payment Panel */}
      {showPayment && (
        <div className="border-t border-slate-100 px-4 py-3 bg-emerald-50 space-y-2">
          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Record Payment</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">ج.م</span>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder={`Max: ${remaining.toFixed(2)}`} className="w-full pl-8 pr-3 py-2 text-sm border border-emerald-300 rounded-lg focus:border-emerald-500 outline-none bg-white" max={remaining} min="0" step="0.01" />
            </div>
            <button onClick={() => setPaymentAmount(remaining.toFixed(2))} className="px-2 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200 whitespace-nowrap">Full</button>
          </div>
          <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2 text-xs border border-emerald-200 rounded-lg focus:border-emerald-400 outline-none bg-white" />
          <div className="flex gap-2">
            <button onClick={() => setShowPayment(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handlePayment} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Confirm Payment</button>
          </div>
        </div>
      )}

      {/* Add Items Panel */}
      {showAddItems && (
        <div className="border-t border-slate-100 px-4 py-3 bg-blue-50 space-y-2">
          <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Add Items to Sale</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 text-xs border border-blue-200 rounded-lg focus:border-blue-400 outline-none bg-white" />
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-lg border border-blue-200 bg-white divide-y divide-slate-50">
              {searchResults.slice(0, 8).map((p) => (
                <button key={p._id} onClick={() => addItemToList(p)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 transition-colors text-left">
                  <span className="font-medium text-slate-800 truncate flex-1">{p.name}</span>
                  <span className="text-blue-600 font-bold ml-2 flex-shrink-0">ج.م{p.userPrice.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          {selectedItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-medium">Selected:</p>
              {selectedItems.map((item) => (
                <div key={item.productId} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-blue-100">
                  <span className="text-xs text-slate-700 truncate flex-1">{item.productName}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <button onClick={() => setSelectedItems((prev) => prev.map((i) => i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1), total: Math.max(1, i.quantity - 1) * i.unitPrice } : i))} className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 text-xs">-</button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => setSelectedItems((prev) => prev.map((i) => i.productId === item.productId ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice } : i))} className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-200 text-xs">+</button>
                    <span className="text-xs font-semibold text-slate-700 w-14 text-right">ج.م{item.total.toFixed(2)}</span>
                    <button onClick={() => setSelectedItems((prev) => prev.filter((i) => i.productId !== item.productId))} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold text-blue-800 pt-1">
                <span>Added total:</span>
                <span>ج.م{selectedItems.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setShowAddItems(false); setSelectedItems([]); setItemSearch(""); }} className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddItems} disabled={selectedItems.length === 0} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">Add to Sale</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CustomersPage ──────────────────────────────────────────────────────
export default function CustomersPage({ selectedStoreId, stores }: {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"customers"> | null>(null);
  const [form, setForm] = useState<CustomerFormData>(EMPTY_FORM);
  const [selectedCustomer, setSelectedCustomer] = useState<Id<"customers"> | null>(null);
  const [loyaltyEdit, setLoyaltyEdit] = useState<string>("");

  const customers = useQuery(api.customers.list, {
    storeId: selectedStoreId ?? undefined,
    search: search.trim() || undefined,
  });
  const stats = useQuery(api.customers.getStats);
  const history = useQuery(
    api.customers.getPurchaseHistory,
    selectedCustomer ? { customerId: selectedCustomer } : "skip"
  );
  const selectedCustomerData = useQuery(
    api.customers.get,
    selectedCustomer ? { customerId: selectedCustomer } : "skip"
  );

  const [detailTab, setDetailTab] = useState<"pending" | "history">("pending");

  const pendingSales = useQuery(
    api.sales.listPendingByCustomer,
    selectedCustomer ? { customerId: selectedCustomer } : "skip"
  );

  const createCustomer = useMutation(api.customers.create);
  const updateCustomer = useMutation(api.customers.update);
  const removeCustomer = useMutation(api.customers.remove);

  const pendingCount = pendingSales?.length ?? 0;
  const totalBalance = pendingSales?.reduce((s, sale) => s + (sale.remainingBalance ?? 0), 0) ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }
    try {
      if (editingId) {
        await updateCustomer({
          customerId: editingId,
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
          loyaltyDiscount: loyaltyEdit ? Number(loyaltyEdit) : undefined,
        });
        toast.success("Customer updated");
      } else {
        await createCustomer({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
          storeId: selectedStoreId ?? undefined,
        });
        toast.success("Customer added");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setLoyaltyEdit("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save customer");
    }
  };

  const handleEdit = (c: any) => {
    setEditingId(c._id);
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setLoyaltyEdit(String(c.loyaltyDiscount ?? 0));
    setShowForm(true);
    setSelectedCustomer(null);
  };

  const handleDelete = async (id: Id<"customers">) => {
    if (!confirm("Delete this customer? Their sales history will remain.")) return;
    try {
      await removeCustomer({ customerId: id });
      toast.success("Customer removed");
      if (selectedCustomer === id) setSelectedCustomer(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Customers</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage customer profiles and loyalty</p>
            </div>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setLoyaltyEdit(""); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Customers", value: stats.totalCustomers, icon: Users, color: "blue" },
                { label: "Total Revenue", value: `ج.م${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: DollarSign, color: "emerald" },
                { label: "Avg. Spend", value: `ج.م${stats.avgSpend.toFixed(0)}`, icon: TrendingUp, color: "purple" },
                { label: "Loyalty Members", value: stats.loyaltyMembers, icon: Award, color: "amber" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className="text-lg font-bold text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-6 py-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-auto p-6">
          {customers === undefined ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No customers yet</h3>
              <p className="text-sm text-slate-400">Add your first customer to start tracking loyalty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((c) => (
                <div
                  key={c._id}
                  onClick={() => setSelectedCustomer(selectedCustomer === c._id ? null : c._id)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedCustomer === c._id ? "border-blue-400 shadow-md ring-1 ring-blue-200" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{c.name}</span>
                          <LoyaltyBadge points={c.loyaltyPoints} discount={c.loyaltyDiscount} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {c.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                          {c.email && <span className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900">ج.م{c.totalSpent.toFixed(0)}</p>
                        <p className="text-xs text-slate-400">{c.totalOrders} orders</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-amber-600">{c.loyaltyPoints} pts</p>
                        <p className="text-xs text-slate-400">loyalty</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedCustomer === c._id ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Customer Detail */}
      {selectedCustomer && selectedCustomerData && (
        <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden animate-slide-in-right">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900">Customer Profile</h2>
              <button onClick={() => setSelectedCustomer(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">{selectedCustomerData.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedCustomerData.name}</h3>
                <LoyaltyBadge points={selectedCustomerData.loyaltyPoints} discount={selectedCustomerData.loyaltyDiscount} />
              </div>
            </div>
            {/* Contact */}
            <div className="space-y-2">
              {selectedCustomerData.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {selectedCustomerData.phone}
                </div>
              )}
              {selectedCustomerData.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {selectedCustomerData.email}
                </div>
              )}
              {selectedCustomerData.address && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {selectedCustomerData.address}
                </div>
              )}
            </div>
          </div>

          {/* Loyalty Stats */}
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Loyalty Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-xs text-amber-600 mb-1">Points</p>
                <p className="text-xl font-bold text-amber-700">{selectedCustomerData.loyaltyPoints.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs text-emerald-600 mb-1">Discount</p>
                <p className="text-xl font-bold text-emerald-700">{selectedCustomerData.loyaltyDiscount}%</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs text-blue-600 mb-1">Total Spent</p>
                <p className="text-lg font-bold text-blue-700">ج.م {selectedCustomerData.totalSpent.toFixed(0)}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                <p className="text-xs text-purple-600 mb-1">Orders</p>
                <p className="text-xl font-bold text-purple-700">{selectedCustomerData.totalOrders}</p>
              </div>
            </div>
            {/* Tier progress */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress to next tier</span>
                <span>{selectedCustomerData.loyaltyPoints} pts</span>
              </div>
              {(() => {
                const pts = selectedCustomerData.loyaltyPoints;
                const tiers = [0, 500, 1000, 2500, 5000];
                const nextTier = tiers.find((t) => t > pts) ?? 5000;
                const prevTier = [...tiers].reverse().find((t) => t <= pts) ?? 0;
                const pct = nextTier === prevTier ? 100 : Math.min(100, ((pts - prevTier) / (nextTier - prevTier)) * 100);
                return (
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                );
              })()}
              <p className="text-xs text-slate-400 mt-1">
                {selectedCustomerData.loyaltyPoints < 500 ? `${500 - selectedCustomerData.loyaltyPoints} pts to Bronze` :
                 selectedCustomerData.loyaltyPoints < 1000 ? `${1000 - selectedCustomerData.loyaltyPoints} pts to Silver` :
                 selectedCustomerData.loyaltyPoints < 2500 ? `${2500 - selectedCustomerData.loyaltyPoints} pts to Gold` :
                 selectedCustomerData.loyaltyPoints < 5000 ? `${5000 - selectedCustomerData.loyaltyPoints} pts to Platinum` :
                 "Maximum tier reached!"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setDetailTab("pending")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${detailTab === "pending" ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pending
              {pendingCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">{pendingCount}</span>}
            </button>
            <button
              onClick={() => setDetailTab("history")}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${detailTab === "history" ? "text-blue-700 border-b-2 border-blue-500 bg-blue-50" : "text-slate-500 hover:text-slate-700"}`}
            >
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {detailTab === "pending" && (
              <>
                {pendingCount > 0 && (
                  <div className="mb-3 p-3 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-semibold text-red-700">{pendingCount} pending sale{pendingCount !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-sm font-bold text-red-700">ج.م{totalBalance.toFixed(2)} due</span>
                  </div>
                )}
                {pendingSales === undefined ? (
                  <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
                ) : pendingSales.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No pending sales</p>
                    <p className="text-xs text-slate-400 mt-1">All payments are up to date</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingSales.map((sale) => (
                      <PendingSaleCard key={sale._id} sale={sale} stores={stores} />
                    ))}
                  </div>
                )}
              </>
            )}

            {detailTab === "history" && (
              <>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <History className="w-3.5 h-3.5" /> Purchase History
                </h3>
                {history === undefined ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}</div>
                ) : history.sales.length === 0 && history.quotations.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No purchase history yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.sales.map((s) => (
                      <div key={s._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{s.saleNumber ?? "Sale"}</p>
                            <p className="text-xs text-slate-400">{new Date(s._creationTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">ج.م{s.total.toFixed(2)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.status === "completed" ? "bg-emerald-100 text-emerald-700" : s.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {history.quotations.map((q) => (
                      <div key={q._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Quotation</p>
                            <p className="text-xs text-slate-400">{new Date(q._creationTime).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">ج.م{q.total.toFixed(2)}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{q.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-bold text-slate-900">{editingId ? "Edit Customer" : "New Customer"}</h2>
              </div>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Customer name"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 0000"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    type="email"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, City"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Manual Loyalty Discount (%)</label>
                  <input
                    value={loyaltyEdit}
                    onChange={(e) => setLoyaltyEdit(e.target.value)}
                    type="number"
                    min="0"
                    max="20"
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Auto-calculated from points, or override manually (0–20%)</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any notes about this customer..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {editingId ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
