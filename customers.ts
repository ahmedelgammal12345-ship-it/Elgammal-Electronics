import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.search && args.search.trim().length > 0) {
      return await ctx.db
        .query("customers")
        .withSearchIndex("search_customers", (q) =>
          q.search("name", args.search!)
        )
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("customers")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("customers").order("desc").take(limit);
  },
});

export const get = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.customerId);
  },
});

export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();
  },
});

// Search customer by phone prefix (for live lookup in POS Terminal)
export const searchByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const phone = args.phone.trim();
    if (phone.length < 7) return null;
    // Try exact match first
    const exact = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    return exact ?? null;
  },
});

export const getPurchaseHistory = query({
  args: { customerId: v.id("customers"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(limit);

    const quotations = await ctx.db
      .query("quotations")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(limit);

    return { sales, quotations };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    // Check for duplicate phone
    if (args.phone) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone!))
        .unique();
      if (existing) {
        throw new ConvexError("A customer with this phone number already exists.");
      }
    }

    return await ctx.db.insert("customers", {
      ...args,
      loyaltyPoints: 0,
      loyaltyDiscount: 0,
      totalSpent: 0,
      totalOrders: 0,
    });
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    loyaltyDiscount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...fields } = args;
    await ctx.db.patch(customerId, fields);
  },
});

export const remove = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.customerId);
  },
});

// Called after a sale is completed to update loyalty stats
export const recordPurchase = mutation({
  args: {
    customerId: v.id("customers"),
    saleTotal: v.number(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return;

    const newTotalSpent = customer.totalSpent + args.saleTotal;
    const newTotalOrders = customer.totalOrders + 1;
    // 1 point per $1 spent
    const newPoints = customer.loyaltyPoints + Math.floor(args.saleTotal);
    // Tier-based discount: 0-499pts=0%, 500-999pts=3%, 1000-2499pts=5%, 2500-4999pts=8%, 5000+=12%
    let newDiscount = 0;
    if (newPoints >= 5000) newDiscount = 12;
    else if (newPoints >= 2500) newDiscount = 8;
    else if (newPoints >= 1000) newDiscount = 5;
    else if (newPoints >= 500) newDiscount = 3;

    await ctx.db.patch(args.customerId, {
      totalSpent: newTotalSpent,
      totalOrders: newTotalOrders,
      loyaltyPoints: newPoints,
      loyaltyDiscount: newDiscount,
    });
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("customers").collect();
    const totalCustomers = all.length;
    const totalRevenue = all.reduce((s, c) => s + c.totalSpent, 0);
    const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    const loyaltyMembers = all.filter((c) => c.loyaltyPoints >= 500).length;
    return { totalCustomers, totalRevenue, avgSpend, loyaltyMembers };
  },
});
