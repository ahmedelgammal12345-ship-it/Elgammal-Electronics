import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Receipt, Banknote, CreditCard, Clock, CheckCircle, XCircle, Eye, X, Printer, Download, Search, Hash, BadgeCheck, TrendingUp, Users, ChevronDown, ChevronUp, Smartphone, FileText } from "lucide-react";
import SaleReceiptModal from "./SaleReceiptModal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface SalesPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}

export default function SalesPage({ selectedStoreId, stores }: SalesPageProps) {
  const [filterPayment, setFilterPayment] = useState<"" | "cash" | "credit" | "phone_transfer" | "cheque">("");
  const [filterStatus, setFilterStatus] = useState<"" | "completed" | "pending" | "cancelled">("");
  const [filterSalesman, setFilterSalesman] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [viewSale, setViewSale] = useState<any | null>(null);
  const [printSale, setPrintSale] = useState<any | null>(null);
  const [showSalesmanPanel, setShowSalesmanPanel] = useState(true);

  const rawSales = useQuery(api.sales.list, {
    storeId: selectedStoreId ?? undefined,
    status: filterStatus || undefined,
  });

  // Per-salesman totals
  const salesmanTotals = useQuery(api.sales.salesmanTotals, {
    storeId: selectedStoreId ?? undefined,
  });

  // Search by sale number (e.g. "MAD-00001")
  const searchResults = useQuery(
    api.sales.searchByNumber,
    searchNumber.trim().length >= 2 ? { searchText: searchNumber.trim() } : "skip"
  );

  // Fetch store details for the receipt header
  const printStore = useQuery(
    api.stores.get,
    printSale?.storeId ? { storeId: printSale.storeId } : "skip"
  );

  // If searching by number, use search results; otherwise apply payment + salesman filter client-side
  const sales = (() => {
    let base = searchNumber.trim().length >= 2
      ? (searchResults ?? [])
      : (rawSales ?? []);
    if (filterPayment) base = base.filter((s) => s.paymentType === filterPayment);
    if (filterSalesman) base = base.filter((s) => (s.salesmanName || "—") === filterSalesman);
    return base;
  })();

  const updateStatus = useMutation(api.sales.updateStatus);

  const handleExport = () => {
    if (!sales || sales.length === 0) {
      toast.error("No sales to export.");
      return;
    }

    // Sheet 1: Summary rows (one row per sale)
    const summaryRows = sales.map((s) => ({
      "Sale No.": s.saleNumber || "",
      Date: new Date(s._creationTime).toLocaleDateString(),
      Time: new Date(s._creationTime).toLocaleTimeString(),
      Customer: s.customerName || "Walk-in",
      Phone: s.customerPhone || "",
      Salesman: s.salesmanName || "—",
      "Payment Type": s.paymentType,
      Status: s.status,
      Items: s.items.length,
      Subtotal: s.subtotal,
      "Discount (%)": s.discount ?? 0,
      Total: s.total,
      Notes: s.notes || "",
    }));

    // Sheet 2: Line items (one row per item across all sales)
    const itemRows = sales.flatMap((s) =>
      s.items.map((item: any) => ({
        "Sale Date": new Date(s._creationTime).toLocaleDateString(),
        Customer: s.customerName || "Walk-in",
        Salesman: s.salesmanName || "—",
        "Product Name": item.productName,
        Quantity: item.quantity,
        "Unit Price": item.unitPrice,
        "Line Total": item.total,
        "Sale Total": s.total,
        "Payment Type": s.paymentType,
        Status: s.status,
      }))
    );

    // Sheet 3: Per-salesman summary
    const salesmanRows = (salesmanTotals ?? []).map((st: any) => ({
      Salesman: st.salesmanName,
      "Total Sales": st.count,
      "Total Revenue (ج.م)": st.totalRevenue.toFixed(2),
      "Avg Sale (ج.م)": st.count > 0 ? (st.totalRevenue / st.count).toFixed(2) : "0.00",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Sales Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "Line Items");
    if (salesmanRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesmanRows), "Salesman Performance");
    }

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `sales-export-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    toast.success(`Exported ${sales.length} sales to Excel!`);
  };

  const handleStatusChange = async (saleId: Id<"sales">, status: "completed" | "pending" | "cancelled") => {
    try {
      await updateStatus({ saleId, status });
      toast.success("Status updated");
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === "pending") return <Clock className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-700",
      pending: "bg-amber-100 text-amber-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return map[status] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
          <p className="text-slate-500 text-sm mt-0.5">{sales?.length ?? 0} transaction{sales?.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!sales || sales.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up stagger-1">
        {/* Sale number search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            placeholder="Search by sale no. (e.g. فرع المعادي-00001)"
            className="pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white w-64"
          />
          {searchNumber && (
            <button
              onClick={() => setSearchNumber("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value as any)}
          disabled={searchNumber.trim().length >= 2}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white disabled:opacity-40"
        >
          <option value="">All Payment Types</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit Card</option>
          <option value="phone_transfer">Phone Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          disabled={searchNumber.trim().length >= 2}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white disabled:opacity-40"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterSalesman}
          onChange={(e) => setFilterSalesman(e.target.value)}
          disabled={searchNumber.trim().length >= 2}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white disabled:opacity-40"
        >
          <option value="">All Salesmen</option>
          {(salesmanTotals ?? []).map((st: any) => (
            <option key={st.name} value={st.name}>{st.name}</option>
          ))}
        </select>
      </div>

      {/* Salesman Performance Panel */}
      {(salesmanTotals ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up stagger-1">
          <button
            onClick={() => setShowSalesmanPanel((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-violet-600" />
              </div>
              <span className="font-semibold text-slate-800 text-sm">Salesman Performance</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {(salesmanTotals ?? []).length} salesmen
              </span>
            </div>
            {showSalesmanPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showSalesmanPanel && (
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-b from-violet-50 to-violet-100/50 border-b border-violet-100">
                    <th className="text-left px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Salesman</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Sales</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Cash</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Credit</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Total Revenue</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-violet-700 text-xs uppercase tracking-wide">Avg Sale</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(salesmanTotals ?? []).map((st: any, idx: number) => (
                    <tr key={st.name} className={`hover:bg-violet-50/40 transition-colors ${filterSalesman === st.name ? "bg-violet-50" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {st.name === "—" ? "?" : st.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{st.name}</p>
                            {idx === 0 && st.name !== "—" && (
                              <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3" /> Top performer
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-700">{st.totalSales}</td>
                      <td className="px-5 py-3 text-right text-emerald-700 font-medium">ج.م{st.cashRevenue.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-amber-700 font-medium">ج.م{st.creditRevenue.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">ج.م{st.totalRevenue.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        ج.م{st.totalSales > 0 ? (st.totalRevenue / st.totalSales).toFixed(2) : "0.00"}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setFilterSalesman(filterSalesman === st.name ? "" : st.name)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                            filterSalesman === st.name
                              ? "bg-violet-600 text-white"
                              : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                          }`}
                        >
                          {filterSalesman === st.name ? "Clear" : "Filter"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Sale No.</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Salesman</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Items</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Payment</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(sales ?? []).map((sale) => (
                <tr key={sale._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sale.saleNumber ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-semibold tracking-wider border border-blue-100">
                        <Hash className="w-3 h-3 opacity-60" />
                        {sale.saleNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(sale._creationTime).toLocaleDateString()}
                    <br />
                    <span className="text-xs text-slate-400">{new Date(sale._creationTime).toLocaleTimeString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{sale.customerName || "Walk-in"}</p>
                    {sale.customerPhone && <p className="text-xs text-slate-400">{sale.customerPhone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {(sale as any).salesmanName ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        <BadgeCheck className="w-3 h-3" />
                        {(sale as any).salesmanName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sale.items.length} item(s)</td>
                  <td className="px-4 py-3">
                    <PaymentBadge paymentType={sale.paymentType} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">ج.م{sale.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={sale.status}
                      onChange={(e) => handleStatusChange(sale._id, e.target.value as any)}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer outline-none ${statusBadge(sale.status)}`}
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewSale(sale)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {sales?.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No sales found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {viewSale && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sale Details</h2>
                {viewSale?.saleNumber && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-semibold tracking-wider border border-blue-100">
                    <Hash className="w-3 h-3 opacity-60" />
                    {viewSale.saleNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPrintSale(viewSale); setViewSale(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button onClick={() => setViewSale(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400 text-xs">Customer</p>
                  <p className="font-medium">{viewSale.customerName || "Walk-in"}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Payment</p>
                  <div className="mt-0.5"><PaymentBadge paymentType={viewSale.paymentType} /></div>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Date</p>
                  <p className="font-medium">{new Date(viewSale._creationTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Status</p>
                  <p className="font-medium capitalize">{viewSale.status}</p>
                </div>
                {(viewSale as any).salesmanName && (
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs mb-1">Salesman</p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-100">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {(viewSale as any).salesmanName}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Items</p>
                <div className="space-y-2">
                  {viewSale.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName} × {item.quantity}</span>
                      <span className="font-medium">ج.م{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>ج.م{viewSale.subtotal.toFixed(2)}</span>
                </div>
                {viewSale.discount && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({viewSale.discount}%)</span>
                    <span>-ج.م{((viewSale.subtotal * viewSale.discount) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-base">
                  <span>Total</span>
                  <span>ج.م{viewSale.total.toFixed(2)}</span>
                </div>
              </div>
              {viewSale.notes && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Notes</p>
                  {viewSale.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {printSale && (
        <SaleReceiptModal
          sale={printSale}
          store={printStore ?? null}
          onClose={() => setPrintSale(null)}
        />
      )}
    </div>
  );
}

// ── Payment Badge ─────────────────────────────────────────────────────────────

const PAYMENT_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  cash:           { label: "Cash",           color: "bg-emerald-100 text-emerald-700", Icon: Banknote },
  credit:         { label: "Credit Card",    color: "bg-amber-100 text-amber-700",     Icon: CreditCard },
  phone_transfer: { label: "Phone Transfer", color: "bg-blue-100 text-blue-700",       Icon: Smartphone },
  cheque:         { label: "Cheque",         color: "bg-purple-100 text-purple-700",   Icon: FileText },
};

function PaymentBadge({ paymentType }: { paymentType: string }) {
  const cfg = PAYMENT_CONFIG[paymentType] ?? { label: paymentType, color: "bg-slate-100 text-slate-600", Icon: Banknote };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
