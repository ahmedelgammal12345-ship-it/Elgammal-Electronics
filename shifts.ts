import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

// Get the currently open shift for a store
export const getActiveShift = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    const shift = await ctx.db
      .query("shifts")
      .withIndex("by_store_and_status", (q) =>
        q.eq("storeId", args.storeId).eq("status", "open")
      )
      .first();

    if (!shift) return null;

    // Enrich with opener info
    const opener = await ctx.db.get(shift.openedBy);
    const events = await ctx.db
      .query("shiftEvents")
      .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
      .collect();

    const cashIn = events
      .filter((e) => e.type === "cash_in")
      .reduce((s, e) => s + (e.amount ?? 0), 0);
    const cashOut = events
      .filter((e) => e.type === "cash_out")
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    return {
      ...shift,
      openerName: opener?.name ?? opener?.email ?? "Unknown",
      cashIn,
      cashOut,
      events,
    };
  },
});

// List shifts for a store (history)
export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    let shifts;

    if (args.storeId) {
      shifts = await ctx.db
        .query("shifts")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    } else {
      shifts = await ctx.db.query("shifts").order("desc").take(limit);
    }

    return await Promise.all(
      shifts.map(async (shift) => {
        const opener = await ctx.db.get(shift.openedBy);
        const closer = shift.closedBy ? await ctx.db.get(shift.closedBy) : null;
        const store = await ctx.db.get(shift.storeId);
        return {
          ...shift,
          openerName: opener?.name ?? opener?.email ?? "Unknown",
          closerName: closer?.name ?? closer?.email ?? undefined,
          storeName: store?.name ?? "Unknown Store",
        };
      })
    );
  },
});

// Open a new shift
export const open = mutation({
  args: {
    storeId: v.id("stores"),
    openingFloat: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("You must be signed in to open a shift");

    // Check no open shift already exists for this store
    const existing = await ctx.db
      .query("shifts")
      .withIndex("by_store_and_status", (q) =>
        q.eq("storeId", args.storeId).eq("status", "open")
      )
      .first();

    if (existing) {
      throw new ConvexError(
        "There is already an open shift for this store. Please close it first."
      );
    }

    return await ctx.db.insert("shifts", {
      storeId: args.storeId,
      openedBy: userId,
      openingFloat: args.openingFloat,
      notes: args.notes,
      status: "open",
      openedAt: Date.now(),
    });
  },
});

// Add a cash in/out event to a shift
export const addEvent = mutation({
  args: {
    shiftId: v.id("shifts"),
    storeId: v.id("stores"),
    type: v.union(v.literal("cash_in"), v.literal("cash_out"), v.literal("note")),
    amount: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.status !== "open") {
      throw new ConvexError("This shift is not open");
    }

    await ctx.db.insert("shiftEvents", {
      shiftId: args.shiftId,
      storeId: args.storeId,
      type: args.type,
      amount: args.amount,
      reason: args.reason,
      createdBy: userId ?? undefined,
    });
  },
});

// Close a shift — calculates totals from sales during the shift period
export const close = mutation({
  args: {
    shiftId: v.id("shifts"),
    closingFloat: v.number(),
    closingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("You must be signed in to close a shift");

    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new ConvexError("Shift not found");
    if (shift.status !== "open") throw new ConvexError("This shift is already closed");

    // Get all sales during this shift period
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_store", (q) => q.eq("storeId", shift.storeId))
      .collect();

    const shiftSales = sales.filter(
      (s) =>
        s._creationTime >= shift.openedAt &&
        s.status === "completed"
    );

    const totalCashSales = shiftSales
      .filter((s) => s.paymentType === "cash")
      .reduce((sum, s) => sum + s.total, 0);

    const totalCreditSales = shiftSales
      .filter((s) => s.paymentType === "credit")
      .reduce((sum, s) => sum + s.total, 0);

    const totalPhoneTransferSales = shiftSales
      .filter((s) => s.paymentType === "phone_transfer")
      .reduce((sum, s) => sum + s.total, 0);

    const totalChequeSales = shiftSales
      .filter((s) => s.paymentType === "cheque")
      .reduce((sum, s) => sum + s.total, 0);

    const totalSales = totalCashSales + totalCreditSales + totalPhoneTransferSales + totalChequeSales;
    const totalTransactions = shiftSales.length;

    // Get cash events
    const events = await ctx.db
      .query("shiftEvents")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();

    const cashIn = events
      .filter((e) => e.type === "cash_in")
      .reduce((s, e) => s + (e.amount ?? 0), 0);
    const cashOut = events
      .filter((e) => e.type === "cash_out")
      .reduce((s, e) => s + (e.amount ?? 0), 0);

    // Get returns during shift
    const returns = await ctx.db
      .query("returns")
      .withIndex("by_store", (q) => q.eq("storeId", shift.storeId))
      .collect();

    const shiftReturns = returns.filter(
      (r) =>
        r._creationTime >= shift.openedAt &&
        r.status === "completed" &&
        r.refundMethod === "cash"
    );
    const totalRefunds = shiftReturns.reduce((sum, r) => sum + r.totalRefund, 0);

    // Expected cash = opening float + cash sales + cash in - cash out - cash refunds
    const expectedCash =
      shift.openingFloat + totalCashSales + cashIn - cashOut - totalRefunds;
    const cashVariance = args.closingFloat - expectedCash;

    await ctx.db.patch(args.shiftId, {
      closedBy: userId,
      closingFloat: args.closingFloat,
      expectedCash,
      cashVariance,
      totalCashSales,
      totalCreditSales,
      totalSales,
      totalTransactions,
      totalRefunds,
      closingNotes: args.closingNotes,
      status: "closed",
      closedAt: Date.now(),
    });
  },
});

// Get a single shift with full details
export const getShiftDetail = query({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) return null;

    const opener = await ctx.db.get(shift.openedBy);
    const closer = shift.closedBy ? await ctx.db.get(shift.closedBy) : null;
    const store = await ctx.db.get(shift.storeId);

    const events = await ctx.db
      .query("shiftEvents")
      .withIndex("by_shift", (q) => q.eq("shiftId", args.shiftId))
      .collect();

    const enrichedEvents = await Promise.all(
      events.map(async (e) => {
        const user = e.createdBy ? await ctx.db.get(e.createdBy) : null;
        return {
          ...e,
          userName: user?.name ?? user?.email ?? "Unknown",
        };
      })
    );

    return {
      ...shift,
      openerName: opener?.name ?? opener?.email ?? "Unknown",
      closerName: closer?.name ?? closer?.email ?? undefined,
      storeName: store?.name ?? "Unknown Store",
      events: enrichedEvents,
    };
  },
});
