import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("bounced")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    if (args.storeId && args.status) {
      return await ctx.db
        .query("cheques")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }
    if (args.storeId) {
      return await ctx.db
        .query("cheques")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }
    if (args.status) {
      return await ctx.db
        .query("cheques")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("cheques").order("desc").take(limit);
  },
});

export const getDueSoon = query({
  args: {
    storeId: v.optional(v.id("stores")),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.daysAhead ?? 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    const todayStr = today.toISOString().split("T")[0];
    const futureStr = future.toISOString().split("T")[0];
    let cheques;
    if (args.storeId) {
      cheques = await ctx.db
        .query("cheques")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", "pending")
        )
        .collect();
    } else {
      cheques = await ctx.db
        .query("cheques")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    }
    return cheques
      .filter((c) => c.dueDate >= todayStr && c.dueDate <= futureStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },
});

export const getOverdue = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    let cheques;
    if (args.storeId) {
      cheques = await ctx.db
        .query("cheques")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", "pending")
        )
        .collect();
    } else {
      cheques = await ctx.db
        .query("cheques")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    }
    return cheques
      .filter((c) => c.dueDate < todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },
});

export const search = query({
  args: { searchText: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchText.trim()) return [];
    return await ctx.db
      .query("cheques")
      .withSearchIndex("search_cheques", (q) =>
        q.search("chequeNumber", args.searchText.trim())
      )
      .take(20);
  },
});

export const updateStatus = mutation({
  args: {
    chequeId: v.id("cheques"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("bounced")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const cheque = await ctx.db.get(args.chequeId);
    if (!cheque) throw new ConvexError("Cheque not found");
    const patch: Record<string, any> = {
      status: args.status,
      notes: args.notes ?? cheque.notes,
    };
    if (args.status === "confirmed") {
      patch.confirmedAt = Date.now();
      patch.confirmedBy = userId ?? undefined;
    }
    await ctx.db.patch(args.chequeId, patch);
  },
});

export const update = mutation({
  args: {
    chequeId: v.id("cheques"),
    chequeNumber: v.optional(v.string()),
    bankName: v.optional(v.string()),
    chequeHolderName: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { chequeId, ...fields } = args;
    const cheque = await ctx.db.get(chequeId);
    if (!cheque) throw new ConvexError("Cheque not found");
    await ctx.db.patch(chequeId, fields);
  },
});

export const getStats = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    let cheques;
    if (args.storeId) {
      cheques = await ctx.db
        .query("cheques")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .collect();
    } else {
      cheques = await ctx.db.query("cheques").collect();
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split("T")[0];

    const pending = cheques.filter((c) => c.status === "pending");
    const confirmed = cheques.filter((c) => c.status === "confirmed");
    const overdue = pending.filter((c) => c.dueDate < todayStr);
    const dueSoon = pending.filter((c) => c.dueDate >= todayStr && c.dueDate <= in7DaysStr);

    return {
      total: cheques.length,
      pending: pending.length,
      confirmed: confirmed.length,
      cancelled: cheques.filter((c) => c.status === "cancelled").length,
      bounced: cheques.filter((c) => c.status === "bounced").length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      pendingAmount: pending.reduce((s, c) => s + c.amount, 0),
      confirmedAmount: confirmed.reduce((s, c) => s + c.amount, 0),
      overdueAmount: overdue.reduce((s, c) => s + c.amount, 0),
    };
  },
});
