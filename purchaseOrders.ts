import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Auto-generate PO number
async function nextPoNumber(ctx: any, storeId: string): Promise<{ poNumber: string; seqNumber: number }> {
  const last = await ctx.db
    .query("purchaseOrders")
    .withIndex("by_seq_number")
    .order("desc")
    .first();
  const seq = (last?.seqNumber ?? 0) + 1;
  const poNumber = `PO-${String(seq).padStart(5, "0")}`;
  return { poNumber, seqNumber: seq };
}

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("ordered"),
        v.literal("partial"),
        v.literal("received"),
        v.literal("cancelled")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.storeId && args.status) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }

    if (args.status) {
      return await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("purchaseOrders").order("desc").take(limit);
  },
});

export const get = query({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.poId);
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    supplierName: v.string(),
    supplierPhone: v.optional(v.string()),
    supplierEmail: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        orderedQty: v.number(),
        receivedQty: v.number(),
        unitCost: v.number(),
        total: v.number(),
      })
    ),
    subtotal: v.number(),
    shippingCost: v.optional(v.number()),
    totalCost: v.number(),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("partial"),
      v.literal("received"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const { poNumber, seqNumber } = await nextPoNumber(ctx, args.storeId);
    return await ctx.db.insert("purchaseOrders", {
      ...args,
      poNumber,
      seqNumber,
    });
  },
});

export const updateStatus = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("partial"),
      v.literal("received"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.poId, { status: args.status });
  },
});

// Receive stock: update received quantities and add to product inventory
export const receiveStock = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    receivedItems: v.array(
      v.object({
        productId: v.id("products"),
        receivedQty: v.number(),
      })
    ),
    receivedDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.poId);
    if (!po) throw new ConvexError("Purchase order not found.");
    if (po.status === "cancelled") throw new ConvexError("Cannot receive a cancelled purchase order.");
    if (po.status === "received") throw new ConvexError("This purchase order has already been fully received.");

    // Update each item's received qty and add to product stock
    const updatedItems = po.items.map((item) => {
      const received = args.receivedItems.find((r) => r.productId === item.productId);
      if (received) {
        return { ...item, receivedQty: item.receivedQty + received.receivedQty };
      }
      return item;
    });

    // Add stock to products
    for (const recv of args.receivedItems) {
      if (recv.receivedQty <= 0) continue;
      const product = await ctx.db.get(recv.productId);
      if (product) {
        await ctx.db.patch(recv.productId, {
          quantity: product.quantity + recv.receivedQty,
        });
        // Log inventory adjustment
        await ctx.db.insert("inventoryAdjustments", {
          storeId: po.storeId,
          productId: recv.productId,
          productName: product.name,
          type: "add",
          quantityBefore: product.quantity,
          quantityChange: recv.receivedQty,
          quantityAfter: product.quantity + recv.receivedQty,
          reason: `Stock received via PO ${po.poNumber}`,
        });
      }
    }

    // Determine new status
    const allReceived = updatedItems.every((i) => i.receivedQty >= i.orderedQty);
    const anyReceived = updatedItems.some((i) => i.receivedQty > 0);
    const newStatus = allReceived ? "received" : anyReceived ? "partial" : po.status;

    await ctx.db.patch(args.poId, {
      items: updatedItems,
      status: newStatus,
      receivedDate: args.receivedDate ?? new Date().toISOString().split("T")[0],
    });
  },
});

export const remove = mutation({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.poId);
    if (!po) throw new ConvexError("Purchase order not found.");
    if (po.status === "received") throw new ConvexError("Cannot delete a received purchase order.");
    await ctx.db.delete(args.poId);
  },
});

export const getStats = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    let orders;
    if (args.storeId) {
      orders = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .collect();
    } else {
      orders = await ctx.db.query("purchaseOrders").collect();
    }

    const draft = orders.filter((o) => o.status === "draft").length;
    const ordered = orders.filter((o) => o.status === "ordered").length;
    const partial = orders.filter((o) => o.status === "partial").length;
    const received = orders.filter((o) => o.status === "received").length;
    const totalValue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.totalCost, 0);

    return { draft, ordered, partial, received, totalValue, total: orders.length };
  },
});
