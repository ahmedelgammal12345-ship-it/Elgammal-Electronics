import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  BarChart2,
  Award,
  Store,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
} from "lucide-react";

interface AnalyticsPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}

const PERIOD_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-slate-400">No prev. data</span>;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? "+" : ""}{value}%
    </span>
  );
}

// Mini bar chart rendered with divs
function MiniBarChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const last14 = data.slice(-14);

  return (
    <div className="flex items-end gap-0.5 h-16">
      {last14.map((d) => {
        const height = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 4 : 0);
        return (
          <div
            key={d.date}
            className="flex-1 group relative"
            title={`${d.date}: ج.م${fmt(d.revenue)} (${d.orders} orders)`}
          >
            <div
              className="w-full bg-blue-500 rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ height: `${height}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
              {d.date.slice(5)}: ج.م{fmt(d.revenue)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage({ selectedStoreId, stores }: AnalyticsPageProps) {
  const [period, setPeriod] = useState(30);

  const summary = useQuery(api.analytics.revenueSummary, {
    storeId: selectedStoreId ?? undefined,
  });
  const daily = useQuery(api.analytics.dailyRevenue, {
    storeId: selectedStoreId ?? undefined,
    days: period || 90,
  });
  const topProducts = useQuery(api.analytics.topProducts, {
    storeId: selectedStoreId ?? undefined,
    limit: 10,
    days: period || undefined,
  });
  const storeComparison = useQuery(api.analytics.storeComparison, {
    days: period || undefined,
  });
  const payments = useQuery(api.analytics.paymentBreakdown, {
    storeId: selectedStoreId ?? undefined,
    days: period || undefined,
  });

  const storeName = selectedStoreId
    ? stores.find((s) => s._id === selectedStoreId)?.name
    : "All Stores";

  const isLoading = summary === undefined;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">{storeName}</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setPeriod(opt.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === opt.days
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Today's Revenue",
            value: isLoading ? "—" : `ج.م${fmt(summary.today)}`,
            icon: DollarSign,
            color: "text-blue-600",
            bg: "bg-blue-50",
            growth: null,
          },
          {
            label: "This Week",
            value: isLoading ? "—" : `ج.م${fmt(summary.week)}`,
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50",
            growth: summary?.weekGrowth ?? null,
          },
          {
            label: "This Month",
            value: isLoading ? "—" : `ج.م${fmt(summary.month)}`,
            icon: BarChart2,
            color: "text-purple-600",
            bg: "bg-purple-50",
            growth: summary?.monthGrowth ?? null,
          },
          {
            label: "Total Orders",
            value: isLoading ? "—" : fmt(summary.totalOrders),
            icon: ShoppingBag,
            color: "text-orange-600",
            bg: "bg-orange-50",
            growth: null,
            sub: isLoading ? "" : `Avg ج.م${fmt(summary.avgOrderValue)}`,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {card.growth !== undefined && <GrowthBadge value={card.growth} />}
              </div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">{card.sub ?? card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Daily Revenue</h2>
          <span className="text-xs text-slate-400">Last 14 days shown</span>
        </div>
        {daily === undefined ? (
          <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ) : daily.every((d) => d.revenue === 0) ? (
          <div className="h-16 flex items-center justify-center text-slate-400 text-sm">
            No sales data for this period
          </div>
        ) : (
          <>
            <MiniBarChart data={daily} />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-400">
                {daily.slice(-14)[0]?.date.slice(5)}
              </span>
              <span className="text-xs text-slate-400">
                {daily[daily.length - 1]?.date.slice(5)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Top Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Top Products</h2>
          </div>
          {topProducts === undefined ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No sales data yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {topProducts.map((p, i) => {
                const maxRev = topProducts[0].revenue;
                const pct = maxRev > 0 ? (p.revenue / maxRev) * 100 : 0;
                return (
                  <div key={p.productId} className="px-6 py-3 flex items-center gap-4">
                    <span className={`w-6 text-xs font-bold text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-slate-300"}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-800">ج.م{fmt(p.revenue)}</p>
                      <p className="text-xs text-slate-400">{p.qty} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800">Payment Methods</h2>
          </div>
          {payments === undefined ? (
            <div className="p-6 space-y-3">
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {[
                { label: "Cash",           icon: Banknote,    data: (payments as any).cash,           color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
                { label: "Credit Card",    icon: CreditCard,  data: (payments as any).credit,         color: "bg-amber-500",   light: "bg-amber-50 text-amber-700" },
                { label: "Phone Transfer", icon: Smartphone,  data: (payments as any).phone_transfer, color: "bg-blue-500",    light: "bg-blue-50 text-blue-700" },
                { label: "Cheque",         icon: FileText,    data: (payments as any).cheque,         color: "bg-purple-500",  light: "bg-purple-50 text-purple-700" },
              ].map((pm) => {
                const Icon = pm.icon;
                const allData = [
                  (payments as any).cash?.revenue ?? 0,
                  (payments as any).credit?.revenue ?? 0,
                  (payments as any).phone_transfer?.revenue ?? 0,
                  (payments as any).cheque?.revenue ?? 0,
                ];
                const grandTotal = allData.reduce((a, b) => a + b, 0);
                const revenue = pm.data?.revenue ?? 0;
                const count = pm.data?.count ?? 0;
                const pct = grandTotal > 0 ? Math.round((revenue / grandTotal) * 100) : 0;
                return (
                  <div key={pm.label} className={`p-4 rounded-xl ${pm.light}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-semibold">{pm.label}</span>
                      </div>
                      <span className="text-xs font-bold">{pct}%</span>
                    </div>
                    <p className="text-xl font-bold">ج.م{fmt(revenue)}</p>
                    <p className="text-xs opacity-70 mt-0.5">{count} transactions</p>
                    <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
                      <div className={`h-full ${pm.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Store Comparison */}
      {!selectedStoreId && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-purple-500" />
            <h2 className="font-semibold text-slate-800">Store Comparison</h2>
          </div>
          {storeComparison === undefined ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : storeComparison.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No stores found</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...storeComparison]
                .sort((a, b) => b.revenue - a.revenue)
                .map((s, i, sorted) => {
                  const maxRev = sorted[0]?.revenue || 1;
                  const pct = maxRev > 0 ? (s.revenue / maxRev) * 100 : 0;
                  return (
                    <div key={s.storeId} className="px-6 py-4 flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{s.storeName}</p>
                        <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-800">ج.م{fmt(s.revenue)}</p>
                        <p className="text-xs text-slate-400">{s.orders} orders · avg ج.م{fmt(s.avgOrder)}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

