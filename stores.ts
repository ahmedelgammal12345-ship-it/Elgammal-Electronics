import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stores").collect();
  },
});

export const get = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storeId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) {
      throw new ConvexError("Store name cannot be empty");
    }
    return await ctx.db.insert("stores", args);
  },
});

export const update = mutation({
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { storeId, ...rest } = args;
    if (!rest.name.trim()) {
      throw new ConvexError("Store name cannot be empty");
    }
    await ctx.db.patch(storeId, rest);
  },
});

export const remove = mutation({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    // Check if store has any sales
    const sale = await ctx.db
      .query("sales")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .first();
    if (sale) {
      throw new ConvexError(
        "Cannot delete this store — it has existing sales records. Deactivate it instead."
      );
    }
    // Check quotations
    const quotation = await ctx.db
      .query("quotations")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .first();
    if (quotation) {
      throw new ConvexError(
        "Cannot delete this store — it has existing quotations. Deactivate it instead."
      );
    }
    await ctx.db.delete(args.storeId);
  },
});
