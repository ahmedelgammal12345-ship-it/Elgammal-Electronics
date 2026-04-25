import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const activeOnly = args.activeOnly ?? true;

    if (args.storeId && activeOnly) {
      return await ctx.db
        .query("salesmen")
        .withIndex("by_store_and_active", (q) =>
          q.eq("storeId", args.storeId!).eq("isActive", true)
        )
        .collect();
    }

    if (args.storeId) {
      return await ctx.db
        .query("salesmen")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .collect();
    }

    if (activeOnly) {
      return await ctx.db
        .query("salesmen")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }

    return await ctx.db.query("salesmen").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Salesman name is required");
    return await ctx.db.insert("salesmen", {
      name: trimmed,
      phone: args.phone || undefined,
      storeId: args.storeId || undefined,
      notes: args.notes || undefined,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    salesmanId: v.id("salesmen"),
    name: v.string(),
    phone: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { salesmanId, ...rest } = args;
    await ctx.db.patch(salesmanId, {
      name: rest.name.trim(),
      phone: rest.phone || undefined,
      storeId: rest.storeId || undefined,
      isActive: rest.isActive,
      notes: rest.notes || undefined,
    });
  },
});

export const remove = mutation({
  args: { salesmanId: v.id("salesmen") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.salesmanId);
  },
});
