import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(v.union(v.literal("draft"), v.literal("sent"), v.literal("accepted"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    // Use index when filtering by store, otherwise fall back to creation time order
    if (args.storeId) {
      let q = ctx.db
        .query("quotations")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!));
      const results = await q.order("desc").take(500);
      if (args.status) return results.filter((r) => r.status === args.status);
      return results;
    }
    if (args.status) {
      return await ctx.db
        .query("quotations")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(500);
    }
    return await ctx.db.query("quotations").order("desc").take(500);
  },
});

export const get = query({
  args: { quotationId: v.id("quotations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quotationId);
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })
    ),
    subtotal: v.number(),
    discount: v.optional(v.number()),
    total: v.number(),
    notes: v.optional(v.string()),
    validUntil: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use the highest seqNumber to generate the next number — avoids full table scan
    const latest = await ctx.db
      .query("quotations")
      .withIndex("by_seq_number")
      .order("desc")
      .first();
    const nextSeq = (latest?.seqNumber ?? 0) + 1;
    const quotationNumber = `QT-${String(nextSeq).padStart(4, "0")}`;
    return await ctx.db.insert("quotations", {
      ...args,
      quotationNumber,
      seqNumber: nextSeq,
      status: "draft",
    });
  },
});

export const updateStatus = mutation({
  args: {
    quotationId: v.id("quotations"),
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("accepted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quotationId, { status: args.status });
  },
});

export const convertToSale = mutation({
  args: { quotationId: v.id("quotations") },
  handler: async (ctx, args) => {
    const quotation = await ctx.db.get(args.quotationId);
    if (!quotation) throw new Error("Quotation not found");

    for (const item of quotation.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        const newQty = Math.max(0, product.quantity - item.quantity);
        await ctx.db.patch(item.productId, { quantity: newQty });
      }
    }

    const saleId = await ctx.db.insert("sales", {
      storeId: quotation.storeId,
      items: quotation.items,
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      total: quotation.total,
      paymentType: "cash",
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      notes: quotation.notes,
      status: "completed",
    });

    await ctx.db.patch(args.quotationId, { status: "accepted" });
    return saleId;
  },
});

export const remove = mutation({
  args: { quotationId: v.id("quotations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.quotationId);
  },
});
