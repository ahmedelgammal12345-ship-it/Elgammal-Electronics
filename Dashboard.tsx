import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, ShoppingCart, CreditCard, Banknote, Package, FileText, Clock } from "lucide-react";

interface DashboardProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}

export default function Dashboard({ selectedStoreId, stores }: DashboardProps) {
  const stats = useQuery(api.sales.getStats, { storeId: selectedStoreId ?? undefined });
  const recentSales = useQuery(api.sales.list, { storeId: selectedStoreId ?? undefined });
  const products = useQuery(api.products.list, {});
  const quotations = useQuery(api.quotations.list, { storeId: selectedStoreId ?? undefined });

  const lowStock = products?.filter((p) => p.quantity <= 5) ?? [];
  const pendingQuotations = quotations?.filter((q) => q.status === "draft" || q.status === "sent") ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {selectedStoreId ? stores.find((s) => s._id === selectedStoreId)?.name : "All Stores Overview"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: `ج.م${(stats?.totalRevenue ?? 0).toFixed(2)}`,
            icon: TrendingUp,
            color: "bg-emerald-500",
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            delay: "stagger-1",
          },
          {
            label: "Total Sales",
            value: stats?.totalSales ?? 0,
            icon: ShoppingCart,
            color: "bg-blue-500",
            bg: "bg-blue-50",
            text: "text-blue-700",
            delay: "stagger-2",
          },
          {
            label: "Cash Sales",
            value: `ج.م${(stats?.cashSales ?? 0).toFixed(2)}`,
            icon: Banknote,
            color: "bg-violet-500",
            bg: "bg-violet-50",
            text: "text-violet-700",
            delay: "stagger-3",
          },
          {
            label: "Credit Sales",
            value: `ج.م ${(stats?.creditSales ?? 0).toFixed(2)}`,
            icon: CreditCard,
            color: "bg-amber-500",
            bg: "bg-amber-50",
            text: "text-amber-700",
            delay: "stagger-4",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`animate-fade-in-up ${stat.delay} bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</span>
                <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${stat.text}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm animate-fade-in-up stagger-2">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Sales</h2>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {(recentSales ?? []).slice(0, 6).map((sale) => (
              <div key={sale._id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{sale.customerName || "Walk-in Customer"}</p>
                  <p className="text-xs text-slate-400">{new Date(sale._creationTime).toLocaleDateString()} · {sale.items.length} item(s)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">ج.م{sale.total.toFixed(2)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    sale.paymentType === "cash" ? "bg-emerald-100 text-emerald-700" :
                    sale.paymentType === "credit" ? "bg-amber-100 text-amber-700" :
                    sale.paymentType === "phone_transfer" ? "bg-blue-100 text-blue-700" :
                    sale.paymentType === "cheque" ? "bg-purple-100 text-purple-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {{ cash: "Cash", credit: "Credit", phone_transfer: "Transfer", cheque: "Cheque" }[sale.paymentType as string] ?? sale.paymentType}
                  </span>
                </div>
              </div>
            ))}
            {(recentSales ?? []).length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No sales yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {/* Low Stock */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm animate-fade-in-up stagger-3">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Low Stock Alert</h2>
              <Package className="w-4 h-4 text-red-400" />
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-auto">
              {lowStock.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate flex-1">{p.name}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${p.quantity === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.quantity}
                  </span>
                </div>
              ))}
              {lowStock.length === 0 && <p className="text-xs text-slate-400 text-center py-3">All products well stocked</p>}
            </div>
          </div>

          {/* Pending Quotations */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm animate-fade-in-up stagger-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Pending Quotations</h2>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div className="p-3 space-y-2 max-h-48 overflow-auto">
              {pendingQuotations.slice(0, 5).map((q) => (
                <div key={q._id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-slate-700 font-medium">{q.quotationNumber}</p>
                    <p className="text-xs text-slate-400">{q.customerName}</p>
                  </div>
                  <span className="text-slate-900 font-bold">ج.م{q.total.toFixed(2)}</span>
                </div>
              ))}
              {pendingQuotations.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No pending quotations</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
