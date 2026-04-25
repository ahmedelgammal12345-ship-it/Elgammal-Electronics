import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function nextSeqNumber(ctx: any): Promise<number> {
  const last = await ctx.db
    .query("fulfillmentRequests")
    .withIndex("by_seq_number")
    .order("desc")
    .first();
  return (last?.seqNumber ?? 0) + 1;
}

function buildRequestNumber(seq: number): string {
  return `FR-${String(seq).padStart(5, "0")}`;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    warehouseId: v.optional(v.id("warehouses")),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("partially_fulfilled"),
      v.literal("fulfilled"),
      v.literal("cancelled")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.storeId && args.status) {
      return await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_store_and_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
        .order("desc")
        .take(limit);
    }

    if (args.warehouseId) {
      return await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_warehouse", (q: any) => q.eq("warehouseId", args.warehouseId))
        .order("desc")
        .take(limit);
    }

    if (args.status) {
      return await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_status", (q: any) => q.eq("status", args.status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("fulfillmentRequests")
      .order("desc")
      .take(limit);
  },
});

export const get = query({
  args: { requestId: v.id("fulfillmentRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

export const getStats = query({
  args: {
    storeId: v.optional(v.id("stores")),
    warehouseId: v.optional(v.id("warehouses")),
  },
  handler: async (ctx, args) => {
    let requests;
    if (args.storeId) {
      requests = await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
        .collect();
    } else if (args.warehouseId) {
      requests = await ctx.db
        .query("fulfillmentRequests")
        .withIndex("by_warehouse", (q: any) => q.eq("warehouseId", args.warehouseId))
        .collect();
    } else {
      requests = await ctx.db.query("fulfillmentRequests").collect();
    }

    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      fulfilled: requests.filter((r) => r.status === "fulfilled" || r.status === "partially_fulfilled").length,
      cancelled: requests.filter((r) => r.status === "cancelled").length,
      urgent: requests.filter((r) => r.priority === "urgent" && r.status === "pending").length,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    warehouseId: v.id("warehouses"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        requestedQty: v.number(),
        warehouseStock: v.optional(v.number()),
      })
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("urgent")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (args.items.length === 0) {
      throw new ConvexError("Please add at least one product to the request");
    }
    for (const item of args.items) {
      if (item.requestedQty <= 0) {
        throw new ConvexError(`Quantity for "${item.productName}" must be greater than zero`);
      }
    }

    const store = await ctx.db.get(args.storeId);
    if (!store) throw new ConvexError("Store not found");

    const warehouse = await ctx.db.get(args.warehouseId);
    if (!warehouse) throw new ConvexError("Warehouse not found");
    if (!warehouse.isActive) throw new ConvexError("This warehouse is currently inactive");

    const seq = await nextSeqNumber(ctx);
    const requestNumber = buildRequestNumber(seq);

    return await ctx.db.insert("fulfillmentRequests", {
      requestNumber,
      storeId: args.storeId,
      storeName: store.name,
      warehouseId: args.warehouseId,
      warehouseName: warehouse.name,
      items: args.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        requestedQty: item.requestedQty,
        fulfilledQty: undefined,
        warehouseStock: item.warehouseStock,
      })),
      status: "pending",
      priority: args.priority,
      notes: args.notes,
      requestedBy: userId ?? undefined,
      seqNumber: seq,
    });
  },
});

export const approve = mutation({
  args: { requestId: v.id("fulfillmentRequests") },
  handler: async (ctx, args) => {
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new ConvexError("Request not found");
    if (req.status !== "pending") {
      throw new ConvexError("Only pending requests can be approved");
    }
    await ctx.db.patch(args.requestId, { status: "approved" });
  },
});

export const fulfill = mutation({
  args: {
    requestId: v.id("fulfillmentRequests"),
    fulfilledItems: v.array(
      v.object({
        productId: v.id("products"),
        fulfilledQty: v.number(),
      })
    ),
    fulfillmentNotes: v.optional(v.string()),
    deductFromWarehouse: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new ConvexError("Request not found");
    if (req.status === "fulfilled") throw new ConvexError("This request has already been fulfilled");
    if (req.status === "cancelled") throw new ConvexError("Cannot fulfill a cancelled request");

    // Build fulfilled items map
    const fulfilledMap = new Map(
      args.fulfilledItems.map((i) => [i.productId, i.fulfilledQty])
    );

    // Update items with fulfilled quantities
    const updatedItems = req.items.map((item) => ({
      ...item,
      fulfilledQty: fulfilledMap.get(item.productId) ?? item.fulfilledQty ?? 0,
    }));

    // Deduct from warehouse stock if requested
    if (args.deductFromWarehouse) {
      for (const item of args.fulfilledItems) {
        if (item.fulfilledQty <= 0) continue;

        const stockRecord = await ctx.db
          .query("warehouseStock")
          .withIndex("by_warehouse_and_product", (q) =>
            q.eq("warehouseId", req.warehouseId).eq("productId", item.productId)
          )
          .unique();

        if (!stockRecord) {
          throw new ConvexError(
            `No stock record found for product in warehouse. Cannot deduct automatically.`
          );
        }
        if (stockRecord.quantity < item.fulfilledQty) {
          const product = await ctx.db.get(item.productId);
          throw new ConvexError(
            `Not enough stock for "${product?.name ?? item.productId}" — only ${stockRecord.quantity} available`
          );
        }
        await ctx.db.patch(stockRecord._id, {
          quantity: stockRecord.quantity - item.fulfilledQty,
        });
      }
    }

    // Determine new status
    const totalRequested = updatedItems.reduce((s, i) => s + i.requestedQty, 0);
    const totalFulfilled = updatedItems.reduce((s, i) => s + (i.fulfilledQty ?? 0), 0);
    const newStatus =
      totalFulfilled === 0
        ? req.status
        : totalFulfilled >= totalRequested
        ? "fulfilled"
        : "partially_fulfilled";

    await ctx.db.patch(args.requestId, {
      items: updatedItems,
      status: newStatus,
      fulfillmentNotes: args.fulfillmentNotes,
      fulfilledBy: userId ?? undefined,
      fulfilledAt: Date.now(),
    });

    // Record a warehouse transfer for audit trail
    for (const item of args.fulfilledItems) {
      if (item.fulfilledQty <= 0) continue;
      const product = await ctx.db.get(item.productId);
      await ctx.db.insert("warehouseTransfers", {
        fromWarehouseId: req.warehouseId,
        toStoreId: req.storeId,
        productId: item.productId,
        productName: product?.name ?? "",
        quantity: item.fulfilledQty,
        notes: `Fulfillment request ${req.requestNumber}`,
        status: "completed",
        createdBy: userId ?? undefined,
      });
    }
  },
});

export const cancel = mutation({
  args: {
    requestId: v.id("fulfillmentRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new ConvexError("Request not found");
    if (req.status === "fulfilled") {
      throw new ConvexError("Cannot cancel a fulfilled request");
    }
    await ctx.db.patch(args.requestId, {
      status: "cancelled",
      fulfillmentNotes: args.reason,
    });
  },
});
