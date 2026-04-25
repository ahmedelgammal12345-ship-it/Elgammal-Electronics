import { query } from "./_generated/server";
import { v } from "convex/values";

// Helper: get start-of-day timestamp (ms) for N days ago
function daysAgo(n: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.getTime();
}

// ✅ SCALABLE helper: fetch only completed sales within a time window
// Uses by_store index (bounded by store) or by_status index (bounded by status)
// then filters by time — avoids reading all-time sales
async function fetchCompletedSales(
  ctx: any,
  storeId: string | undefined,
  since: number
) {
  if (storeId) {
    // Read completed sales for this store, most recent first
    // We use by_store_and_status to get only completed, then filter by time
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_store_and_status", (q: any) =>
        q.eq("storeId", storeId).eq("status", "completed")
      )
      .order("desc")
      .take(8000); // safety cap — 8k completed sales per store is plenty
    return since > 0 ? sales.filter((s: any) => s._creationTime >= since) : sales;
  }

  // All stores — use status index to get only completed
  const sales = await ctx.db
    .query("sales")
    .withIndex("by_status", (q: any) => q.eq("status", "completed"))
    .order("desc")
    .take(8000);
  return since > 0 ? sales.filter((s: any) => s._creationTime >= since) : sales;
}

export const revenueSummary = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    // Only need last 60 days for all comparisons
    const since = daysAgo(60);
    const completed = await fetchCompletedSales(ctx, args.storeId, since);

    const today = daysAgo(0);
    const week = daysAgo(7);
    const month = daysAgo(30);
    const prevWeekStart = daysAgo(14);
    const prevMonthStart = daysAgo(60);

    const todayRev = completed
      .filter((s: any) => s._creationTime >= today)
      .reduce((sum: number, s: any) => sum + s.total, 0);

    const weekRev = completed
      .filter((s: any) => s._creationTime >= week)
      .reduce((sum: number, s: any) => sum + s.total, 0);

    const monthRev = completed
      .filter((s: any) => s._creationTime >= month)
      .reduce((sum: number, s: any) => sum + s.total, 0);

    const prevWeekRev = completed
      .filter((s: any) => s._creationTime >= prevWeekStart && s._creationTime < week)
      .reduce((sum: number, s: any) => sum + s.total, 0);

    const prevMonthRev = completed
      .filter((s: any) => s._creationTime >= prevMonthStart && s._creationTime < month)
      .reduce((sum: number, s: any) => sum + s.total, 0);

    // Total revenue needs all-time — fetch separately without time bound
    const allCompleted = await fetchCompletedSales(ctx, args.storeId, 0);
    const totalRev = allCompleted.reduce((sum: number, s: any) => sum + s.total, 0);

    return {
      today: todayRev,
      week: weekRev,
      month: monthRev,
      total: totalRev,
      weekGrowth:
        prevWeekRev > 0
          ? Math.round(((weekRev - prevWeekRev) / prevWeekRev) * 100)
          : null,
      monthGrowth:
        prevMonthRev > 0
          ? Math.round(((monthRev - prevMonthRev) / prevMonthRev) * 100)
          : null,
      totalOrders: allCompleted.length,
      avgOrderValue:
        allCompleted.length > 0
          ? Math.round(totalRev / allCompleted.length)
          : 0,
    };
  },
});

export const dailyRevenue = query({
  args: {
    storeId: v.optional(v.id("stores")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const since = daysAgo(days);

    const completed = await fetchCompletedSales(ctx, args.storeId, since);

    // Build date buckets
    const byDate: Record<string, { revenue: number; orders: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDate[key] = { revenue: 0, orders: 0 };
    }

    for (const sale of completed) {
      const key = new Date(sale._creationTime).toISOString().slice(0, 10);
      if (byDate[key]) {
        byDate[key].revenue += sale.total;
        byDate[key].orders += 1;
      }
    }

    return Object.entries(byDate).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue),
      orders: data.orders,
    }));
  },
});

export const topProducts = query({
  args: {
    storeId: v.optional(v.id("stores")),
    limit: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const since = args.days ? daysAgo(args.days) : 0;

    const completed = await fetchCompletedSales(ctx, args.storeId, since);

    const productMap: Record<
      string,
      { name: string; qty: number; revenue: number }
    > = {};

    for (const sale of completed) {
      for (const item of sale.items) {
        const id = item.productId as string;
        if (!productMap[id]) {
          productMap[id] = { name: item.productName, qty: 0, revenue: 0 };
        }
        productMap[id].qty += item.quantity;
        productMap[id].revenue += item.total;
      }
    }

    return Object.entries(productMap)
      .map(([id, data]) => ({ productId: id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },
});

export const storeComparison = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const since = args.days ? daysAgo(args.days) : 0;

    const stores = await ctx.db.query("stores").collect(); // max 4 stores — fine
    const completed = await fetchCompletedSales(ctx, undefined, since);

    return stores.map((store) => {
      const storeSales = completed.filter((s: any) => s.storeId === store._id);
      const revenue = storeSales.reduce((sum: number, s: any) => sum + s.total, 0);
      const orders = storeSales.length;
      return {
        storeId: store._id,
        storeName: store.name,
        revenue: Math.round(revenue),
        orders,
        avgOrder: orders > 0 ? Math.round(revenue / orders) : 0,
      };
    });
  },
});

export const paymentBreakdown = query({
  args: {
    storeId: v.optional(v.id("stores")),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.days ? daysAgo(args.days) : 0;
    const completed = await fetchCompletedSales(ctx, args.storeId, since);

    const cash = completed.filter((s: any) => s.paymentType === "cash");
    const credit = completed.filter((s: any) => s.paymentType === "credit");
    const phoneTransfer = completed.filter((s: any) => s.paymentType === "phone_transfer");
    const cheque = completed.filter((s: any) => s.paymentType === "cheque");

    return {
      cash: {
        count: cash.length,
        revenue: Math.round(cash.reduce((sum: number, s: any) => sum + s.total, 0)),
      },
      credit: {
        count: credit.length,
        revenue: Math.round(credit.reduce((sum: number, s: any) => sum + s.total, 0)),
      },
      phone_transfer: {
        count: phoneTransfer.length,
        revenue: Math.round(phoneTransfer.reduce((sum: number, s: any) => sum + s.total, 0)),
      },
      cheque: {
        count: cheque.length,
        revenue: Math.round(cheque.reduce((sum: number, s: any) => sum + s.total, 0)),
      },
    };
  },
});
