import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper: get next sequential sale number FOR A SPECIFIC STORE (independent counter per store)
async function nextSaleSeqForStore(ctx: any, storeId: Id<"stores">): Promise<number> {
  const last = await ctx.db
    .query("sales")
    .withIndex("by_store_and_seq", (q: any) => q.eq("storeId", storeId))
    .order("desc")
    .first();
  return (last?.seqNumber ?? 0) + 1;
}

// Helper: get the store name to use in sale numbers (e.g. "فرع المعادي")
async function getStoreName(ctx: any, storeId: Id<"stores">): Promise<string> {
  const store = await ctx.db.get(storeId);
  if (store?.name && store.name.trim().length > 0) {
    return store.name.trim();
  }
  return "فرع";
}

// Format: "فرع المعادي-00001", "فرع مدينة نصر-00042", etc.
function formatSaleNumber(storeName: string, seq: number): string {
  return `${storeName}-${String(seq).padStart(5, "0")}`;
}

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    status: v.optional(v.union(v.literal("completed"), v.literal("pending"), v.literal("cancelled"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;

    // Use compound index when both storeId and status are provided
    if (args.storeId && args.status) {
      return await ctx.db
        .query("sales")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    if (args.storeId) {
      return await ctx.db
        .query("sales")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .order("desc")
        .take(limit);
    }

    if (args.status) {
      return await ctx.db
        .query("sales")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("sales").order("desc").take(limit);
  },
});

export const get = query({
  args: { saleId: v.id("sales") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.saleId);
  },
});

// Search sales by sale number (e.g. "SAL-00042") or partial number
export const searchByNumber = query({
  args: { searchText: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchText.trim()) return [];
    return await ctx.db
      .query("sales")
      .withSearchIndex("search_by_sale_number", (q) =>
        q.search("saleNumber", args.searchText.trim())
      )
      .take(20);
  },
});

// Get a single sale by its exact sale number (e.g. "فرع المعادي-00001")
export const getByNumber = query({
  args: { saleNumber: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.saleNumber.trim();
    if (!trimmed) return null;
    // Use search index then find exact match
    const results = await ctx.db
      .query("sales")
      .withSearchIndex("search_by_sale_number", (q) =>
        q.search("saleNumber", trimmed)
      )
      .take(10);
    return results.find((s) => s.saleNumber === trimmed) ?? null;
  },
});

// List pending (deposit) sales for a specific customer
export const listPendingByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("sales")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect();
    return all.filter((s) => s.status === "pending");
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    customerId: v.optional(v.id("customers")),
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
    specialDiscount: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    total: v.number(),
    paymentType: v.union(v.literal("cash"), v.literal("credit"), v.literal("phone_transfer"), v.literal("cheque")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    salesmanName: v.optional(v.string()),
    chequeNumber: v.optional(v.string()),
    bankName: v.optional(v.string()),
    chequeHolderName: v.optional(v.string()),
    chequeDueDate: v.optional(v.string()),
    // Deposit / partial payment
    deposit: v.optional(v.number()),
    isPartialPayment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Deduct stock for each item
    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        const newQty = Math.max(0, product.quantity - item.quantity);
        await ctx.db.patch(item.productId, { quantity: newQty });
      }
    }

    const seqNumber = await nextSaleSeqForStore(ctx, args.storeId);
    const storeName = await getStoreName(ctx, args.storeId);
    const saleNumber = formatSaleNumber(storeName, seqNumber);

    // Determine status and payment tracking
    const isPartial = !!(args.isPartialPayment && args.deposit !== undefined && args.deposit < args.total);
    const deposit = args.deposit ?? args.total;
    const amountPaid = isPartial ? deposit : args.total;
    const remainingBalance = isPartial ? args.total - deposit : 0;
    const status = isPartial ? "pending" : "completed";

    const saleId = await ctx.db.insert("sales", {
      storeId: args.storeId,
      customerId: args.customerId,
      items: args.items,
      subtotal: args.subtotal,
      discount: args.discount,
      specialDiscount: args.specialDiscount,
      taxRate: args.taxRate,
      taxAmount: args.taxAmount,
      total: args.total,
      paymentType: args.paymentType,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      notes: args.notes,
      salesmanName: args.salesmanName,
      chequeNumber: args.chequeNumber,
      bankName: args.bankName,
      chequeHolderName: args.chequeHolderName,
      chequeDueDate: args.chequeDueDate,
      status,
      seqNumber,
      saleNumber,
      deposit: isPartial ? deposit : undefined,
      amountPaid: isPartial ? amountPaid : undefined,
      remainingBalance: isPartial ? remainingBalance : undefined,
    });

    // Auto-create cheque record when payment type is cheque
    if (
      args.paymentType === "cheque" &&
      args.chequeNumber &&
      args.bankName &&
      args.chequeHolderName &&
      args.chequeDueDate
    ) {
      await ctx.db.insert("cheques", {
        saleId,
        saleNumber,
        storeId: args.storeId,
        chequeNumber: args.chequeNumber,
        bankName: args.bankName,
        chequeHolderName: args.chequeHolderName,
        amount: args.total,
        dueDate: args.chequeDueDate,
        status: "pending",
        customerName: args.customerName,
        customerPhone: args.customerPhone,
      });
    }

    return saleId;
  },
});

// Add a payment to a pending (deposit) sale
export const addPayment = mutation({
  args: {
    saleId: v.id("sales"),
    amount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new ConvexError("Sale not found.");
    if (sale.status === "completed") throw new ConvexError("This sale is already fully paid.");
    if (sale.status === "cancelled") throw new ConvexError("This sale has been cancelled.");

    const currentPaid = sale.amountPaid ?? sale.total;
    const currentRemaining = sale.remainingBalance ?? 0;

    if (args.amount <= 0) throw new ConvexError("Payment amount must be greater than zero.");
    if (args.amount > currentRemaining + 0.001) {
      throw new ConvexError(`Payment (ج.م${args.amount.toFixed(2)}) exceeds remaining balance (ج.م${currentRemaining.toFixed(2)}).`);
    }

    const newAmountPaid = currentPaid + args.amount;
    const newRemaining = Math.max(0, sale.total - newAmountPaid);
    const isFullyPaid = newRemaining <= 0.001;

    const noteAppend = args.notes
      ? `Payment of ج.م${args.amount.toFixed(2)} received. ${args.notes}`
      : `Payment of ج.م${args.amount.toFixed(2)} received.`;
    const notesUpdate = sale.notes ? `${sale.notes}\n${noteAppend}` : noteAppend;

    await ctx.db.patch(args.saleId, {
      amountPaid: newAmountPaid,
      remainingBalance: newRemaining,
      status: isFullyPaid ? "completed" : "pending",
      notes: notesUpdate,
    });

    return { newAmountPaid, newRemaining, isFullyPaid };
  },
});

// Add more items to a pending sale
export const addItems = mutation({
  args: {
    saleId: v.id("sales"),
    newItems: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new ConvexError("Sale not found.");
    if (sale.status === "completed") throw new ConvexError("Cannot add items to a completed sale.");
    if (sale.status === "cancelled") throw new ConvexError("Cannot add items to a cancelled sale.");

    // Deduct stock for new items
    for (const item of args.newItems) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(item.productId, { quantity: Math.max(0, product.quantity - item.quantity) });
      }
    }

    // Merge items (combine quantities if same product)
    const existingItems = [...sale.items];
    for (const newItem of args.newItems) {
      const idx = existingItems.findIndex((i) => i.productId === newItem.productId);
      if (idx >= 0) {
        existingItems[idx] = {
          ...existingItems[idx],
          quantity: existingItems[idx].quantity + newItem.quantity,
          total: existingItems[idx].total + newItem.total,
        };
      } else {
        existingItems.push(newItem);
      }
    }

    const addedTotal = args.newItems.reduce((s, i) => s + i.total, 0);
    const newSubtotal = sale.subtotal + addedTotal;
    const discountAmt = sale.discount ? (newSubtotal * sale.discount) / 100 : 0;
    const specialDisc = sale.specialDiscount ?? 0;
    const taxAmt = sale.taxRate ? (newSubtotal * sale.taxRate) / 100 : 0;
    const newTotal = Math.max(0, newSubtotal - discountAmt - specialDisc + taxAmt);
    const newRemaining = Math.max(0, newTotal - (sale.amountPaid ?? sale.total));

    const noteAppend = args.notes
      ? `Items added: ${args.newItems.map((i) => i.productName).join(", ")}. ${args.notes}`
      : `Items added: ${args.newItems.map((i) => i.productName).join(", ")}.`;
    const notesUpdate = sale.notes ? `${sale.notes}\n${noteAppend}` : noteAppend;

    await ctx.db.patch(args.saleId, {
      items: existingItems,
      subtotal: newSubtotal,
      total: newTotal,
      remainingBalance: newRemaining,
      notes: notesUpdate,
    });

    return { newTotal, newRemaining };
  },
});

// Cancel a pending sale (restores stock)
export const cancelPendingSale = mutation({
  args: {
    saleId: v.id("sales"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new ConvexError("Sale not found.");
    if (sale.status === "completed") throw new ConvexError("Cannot cancel a completed sale. Use Returns instead.");

    // Restore stock
    for (const item of sale.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(item.productId, { quantity: product.quantity + item.quantity });
      }
    }

    const noteAppend = args.reason ? `Cancelled: ${args.reason}` : "Sale cancelled.";
    await ctx.db.patch(args.saleId, {
      status: "cancelled",
      notes: sale.notes ? `${sale.notes}\n${noteAppend}` : noteAppend,
    });
  },
});

// Returns aggregated totals grouped by salesmanName for a given store
export const salesmanTotals = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    let sales;
    if (args.storeId) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", "completed")
        )
        .collect();
    } else {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_status", (q) => q.eq("status", "completed"))
        .collect();
    }

    const map: Record<string, { name: string; totalSales: number; totalRevenue: number; cashRevenue: number; creditRevenue: number }> = {};
    for (const s of sales) {
      const key = s.salesmanName?.trim() || "—";
      if (!map[key]) {
        map[key] = { name: key, totalSales: 0, totalRevenue: 0, cashRevenue: 0, creditRevenue: 0 };
      }
      map[key].totalSales++;
      map[key].totalRevenue += s.total;
      if (s.paymentType === "cash") map[key].cashRevenue += s.total;
      else map[key].creditRevenue += s.total;
    }

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  },
});

export const updateStatus = mutation({
  args: {
    saleId: v.id("sales"),
    status: v.union(v.literal("completed"), v.literal("pending"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.saleId, { status: args.status });
  },
});

// ✅ SCALABLE: Uses indexes — no full table scan
export const getStats = query({
  args: { storeId: v.optional(v.id("stores")) },
  handler: async (ctx, args) => {
    let completed, pending, cancelled;

    if (args.storeId) {
      completed = await ctx.db
        .query("sales")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", "completed")
        )
        .collect();
      pending = await ctx.db
        .query("sales")
        .withIndex("by_store_and_status", (q) =>
          q.eq("storeId", args.storeId!).eq("status", "pending")
        )
        .collect();
    } else {
      completed = await ctx.db
        .query("sales")
        .withIndex("by_status", (q) => q.eq("status", "completed"))
        .collect();
      pending = await ctx.db
        .query("sales")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    }

    const totalRevenue = completed.reduce((sum, s) => sum + s.total, 0);
    const cashSales = completed
      .filter((s) => s.paymentType === "cash")
      .reduce((sum, s) => sum + s.total, 0);
    const creditSales = completed
      .filter((s) => s.paymentType === "credit")
      .reduce((sum, s) => sum + s.total, 0);

    return {
      totalSales: completed.length,
      totalRevenue,
      cashSales,
      creditSales,
      pendingCount: pending.length,
    };
  },
});
