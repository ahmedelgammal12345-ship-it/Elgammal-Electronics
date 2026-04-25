import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    productId: v.optional(v.id("products")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.productId) {
      return await ctx.db
        .query("inventoryAdjustments")
        .withIndex("by_product", (q) => q.eq("productId", args.productId!))
        .order("desc")
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("inventoryAdjustments")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("inventoryAdjustments")
      .order("desc")
      .take(limit);
  },
});

export const adjust = mutation({
  args: {
    storeId: v.id("stores"),
    productId: v.id("products"),
    type: v.union(
      v.literal("add"),
      v.literal("remove"),
      v.literal("set"),
      v.literal("damage"),
      v.literal("return")
    ),
    quantityChange: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError("Product not found.");

    const quantityBefore = product.quantity;
    let quantityAfter: number;

    if (args.type === "set") {
      if (args.quantityChange < 0)
        throw new ConvexError("Set quantity cannot be negative.");
      quantityAfter = args.quantityChange;
    } else if (args.type === "add" || args.type === "return") {
      if (args.quantityChange <= 0)
        throw new ConvexError("Quantity to add must be greater than zero.");
      quantityAfter = quantityBefore + args.quantityChange;
    } else {
      // remove or damage
      if (args.quantityChange <= 0)
        throw new ConvexError("Quantity to remove must be greater than zero.");
      if (args.quantityChange > quantityBefore)
        throw new ConvexError(
          `Cannot remove ${args.quantityChange} units — only ${quantityBefore} in stock.`
        );
      quantityAfter = quantityBefore - args.quantityChange;
    }

    await ctx.db.patch(args.productId, { quantity: quantityAfter });

    await ctx.db.insert("inventoryAdjustments", {
      storeId: args.storeId,
      productId: args.productId,
      productName: product.name,
      type: args.type,
      quantityBefore,
      quantityChange: args.quantityChange,
      quantityAfter,
      reason: args.reason,
      notes: args.notes,
      createdBy: userId ?? undefined,
    });

    return { quantityBefore, quantityAfter };
  },
});

// ✅ SCALABLE: Uses index range query — reads only low-stock docs, not all 22k
export const getLowStock = query({
  args: {
    storeId: v.optional(v.id("stores")),
    threshold: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const threshold = args.threshold ?? 10;
    const limit = args.limit ?? 100;

    if (args.storeId) {
      // Use compound index: filter by store, then range on quantity
      return await ctx.db
        .query("products")
        .withIndex("by_store_and_quantity", (q) =>
          q.eq("storeId", args.storeId!).lt("quantity", threshold + 1)
        )
        .order("asc")
        .take(limit);
    }

    // No store filter — use quantity index directly
    return await ctx.db
      .query("products")
      .withIndex("by_quantity", (q) => q.lt("quantity", threshold + 1))
      .order("asc")
      .take(limit);
  },
});
