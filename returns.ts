import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function nextSeq(ctx: any): Promise<number> {
  const last = await ctx.db
    .query("returns")
    .withIndex("by_seq_number")
    .order("desc")
    .first();
  return (last?.seqNumber ?? 0) + 1;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("completed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;

    if (args.storeId && args.status) {
      return await ctx.db
        .query("returns")
        .withIndex("by_store_and_status", (q: any) =>
          q.eq("storeId", args.storeId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("returns")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }

    if (args.status) {
      return await ctx.db
        .query("returns")
        .withIndex("by_status", (q: any) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("returns").order("desc").take(limit);
  },
});

export const getBySale = query({
  args: { saleId: v.id("sales") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("returns")
      .withIndex("by_sale", (q) => q.eq("saleId", args.saleId))
      .collect();
  },
});

export const getStats = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    let all;
    if (args.storeId) {
      all = await ctx.db
        .query("returns")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId!))
        .collect();
    } else {
      all = await ctx.db.query("returns").collect();
    }

    const completed = all.filter((r) => r.status === "completed");
    const pending = all.filter((r) => r.status === "pending");
    const totalRefunded = completed.reduce((s, r) => s + r.totalRefund, 0);
    const totalItems = completed.reduce(
      (s, r) => s + r.items.reduce((si, i) => si + i.quantity, 0),
      0
    );

    return {
      total: all.length,
      pending: pending.length,
      completed: completed.length,
      totalRefunded,
      totalItems,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    saleId: v.optional(v.id("sales")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
        reason: v.string(),
        condition: v.union(
          v.literal("resalable"),
          v.literal("damaged"),
          v.literal("defective")
        ),
        restockQty: v.number(),
      })
    ),
    totalRefund: v.number(),
    refundMethod: v.union(
      v.literal("cash"),
      v.literal("credit"),
      v.literal("store_credit"),
      v.literal("exchange")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (args.items.length === 0)
      throw new ConvexError("At least one item is required.");

    const seq = await nextSeq(ctx);
    const returnNumber = `RET-${String(seq).padStart(4, "0")}`;

    const returnId = await ctx.db.insert("returns", {
      ...args,
      returnNumber,
      status: "pending",
      processedBy: userId ?? undefined,
      seqNumber: seq,
    });

    return { returnId, returnNumber };
  },
});

export const approve = mutation({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new ConvexError("Return not found.");
    if (ret.status !== "pending")
      throw new ConvexError("Only pending returns can be approved.");

    // Restock items back into inventory
    for (const item of ret.items) {
      if (item.restockQty > 0) {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(item.productId, {
            quantity: product.quantity + item.restockQty,
          });
          // Log inventory adjustment
          await ctx.db.insert("inventoryAdjustments", {
            storeId: ret.storeId,
            productId: item.productId,
            productName: item.productName,
            type: "return",
            quantityBefore: product.quantity,
            quantityChange: item.restockQty,
            quantityAfter: product.quantity + item.restockQty,
            reason: `Return ${ret.returnNumber} - ${item.reason}`,
            notes: `Condition: ${item.condition}`,
          });
        }
      }
    }

    await ctx.db.patch(args.returnId, { status: "completed" });
  },
});

export const reject = mutation({
  args: { returnId: v.id("returns"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new ConvexError("Return not found.");
    if (ret.status !== "pending")
      throw new ConvexError("Only pending returns can be rejected.");

    await ctx.db.patch(args.returnId, {
      status: "rejected",
      notes: args.notes ?? ret.notes,
    });
  },
});

export const remove = mutation({
  args: { returnId: v.id("returns") },
  handler: async (ctx, args) => {
    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new ConvexError("Return not found.");
    if (ret.status === "completed") {
      throw new ConvexError(
        "Cannot delete a completed return. Inventory has already been restocked."
      );
    }
    await ctx.db.delete(args.returnId);
  },
});
