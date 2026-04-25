import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Warehouses CRUD ──────────────────────────────────────────────────────────

export const list = query({
  args: {
    storeId: v.optional(v.id("stores")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const activeOnly = args.activeOnly ?? false;

    let warehouses;
    if (args.storeId) {
      warehouses = await ctx.db
        .query("warehouses")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId!))
        .collect();
    } else {
      warehouses = await ctx.db.query("warehouses").collect();
    }

    if (activeOnly) {
      warehouses = warehouses.filter((w) => w.isActive);
    }

    return warehouses;
  },
});

export const get = query({
  args: { warehouseId: v.id("warehouses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.warehouseId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    managerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (!trimmed) throw new ConvexError("Warehouse name is required");
    return await ctx.db.insert("warehouses", {
      name: trimmed,
      code: args.code?.trim() || undefined,
      address: args.address?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      managerName: args.managerName?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      storeId: args.storeId || undefined,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    warehouseId: v.id("warehouses"),
    name: v.string(),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    managerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { warehouseId, ...rest } = args;
    if (!rest.name.trim()) throw new ConvexError("Warehouse name is required");
    await ctx.db.patch(warehouseId, {
      name: rest.name.trim(),
      code: rest.code?.trim() || undefined,
      address: rest.address?.trim() || undefined,
      phone: rest.phone?.trim() || undefined,
      managerName: rest.managerName?.trim() || undefined,
      notes: rest.notes?.trim() || undefined,
      storeId: rest.storeId || undefined,
      isActive: rest.isActive,
    });
  },
});

export const remove = mutation({
  args: { warehouseId: v.id("warehouses") },
  handler: async (ctx, args) => {
    const stock = await ctx.db
      .query("warehouseStock")
      .withIndex("by_warehouse", (q) => q.eq("warehouseId", args.warehouseId))
      .first();
    if (stock) {
      throw new ConvexError(
        "Cannot delete this warehouse — it has stock records. Deactivate it instead."
      );
    }
    await ctx.db.delete(args.warehouseId);
  },
});

// ─── Stock Management ─────────────────────────────────────────────────────────

export const getStock = query({
  args: {
    warehouseId: v.id("warehouses"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("warehouseStock")
      .withIndex("by_warehouse", (q) => q.eq("warehouseId", args.warehouseId))
      .collect();
  },
});

export const adjustStock = mutation({
  args: {
    warehouseId: v.id("warehouses"),
    productId: v.id("products"),
    quantity: v.number(),
    minQuantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.quantity < 0) throw new ConvexError("Quantity cannot be negative");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError("Product not found");

    const existing = await ctx.db
      .query("warehouseStock")
      .withIndex("by_warehouse_and_product", (q) =>
        q.eq("warehouseId", args.warehouseId).eq("productId", args.productId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        minQuantity: args.minQuantity,
      });
    } else {
      await ctx.db.insert("warehouseStock", {
        warehouseId: args.warehouseId,
        productId: args.productId,
        productName: product.name,
        quantity: args.quantity,
        minQuantity: args.minQuantity,
      });
    }
  },
});

// ─── Bulk Stock Import (resolves product by name or barcode) ──────────────────

export const bulkAdjustStock = mutation({
  args: {
    items: v.array(
      v.object({
        warehouseId: v.id("warehouses"),
        productName: v.string(),
        barcode: v.optional(v.string()),
        quantity: v.number(),
        minQuantity: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    // Load all products once for efficient lookup
    const allProducts = await ctx.db.query("products").collect();
    const byBarcode = new Map(
      allProducts
        .filter((p) => p.barcode)
        .map((p) => [p.barcode!.toLowerCase(), p])
    );
    const byName = new Map(
      allProducts.map((p) => [p.name.toLowerCase().trim(), p])
    );

    for (const item of args.items) {
      try {
        if (item.quantity < 0) {
          errors.push(`Row skipped: negative quantity for "${item.productName}"`);
          continue;
        }

        // Resolve product
        let product =
          (item.barcode ? byBarcode.get(item.barcode.toLowerCase()) : undefined) ??
          byName.get(item.productName.toLowerCase().trim());

        if (!product) {
          errors.push(`Product not found: "${item.productName}"${item.barcode ? ` (barcode: ${item.barcode})` : ""}`);
          continue;
        }

        const existing = await ctx.db
          .query("warehouseStock")
          .withIndex("by_warehouse_and_product", (q) =>
            q.eq("warehouseId", item.warehouseId).eq("productId", product!._id)
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            quantity: item.quantity,
            minQuantity: item.minQuantity,
          });
          updated++;
        } else {
          await ctx.db.insert("warehouseStock", {
            warehouseId: item.warehouseId,
            productId: product._id,
            productName: product.name,
            quantity: item.quantity,
            minQuantity: item.minQuantity,
          });
          created++;
        }
      } catch (e) {
        errors.push(`Error on "${item.productName}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { updated, created, errors };
  },
});

// ─── Transfers ────────────────────────────────────────────────────────────────

export const listTransfers = query({
  args: {
    warehouseId: v.optional(v.id("warehouses")),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.warehouseId) {
      const fromTransfers = await ctx.db
        .query("warehouseTransfers")
        .withIndex("by_from_warehouse", (q) => q.eq("fromWarehouseId", args.warehouseId!))
        .order("desc")
        .take(limit);
      const toTransfers = await ctx.db
        .query("warehouseTransfers")
        .withIndex("by_to_warehouse", (q) => q.eq("toWarehouseId", args.warehouseId!))
        .order("desc")
        .take(limit);
      const all = [...fromTransfers, ...toTransfers];
      all.sort((a, b) => b._creationTime - a._creationTime);
      return all.slice(0, limit);
    }

    if (args.status) {
      return await ctx.db
        .query("warehouseTransfers")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("warehouseTransfers")
      .order("desc")
      .take(limit);
  },
});

export const createTransfer = mutation({
  args: {
    fromWarehouseId: v.optional(v.id("warehouses")),
    toWarehouseId: v.optional(v.id("warehouses")),
    fromStoreId: v.optional(v.id("stores")),
    toStoreId: v.optional(v.id("stores")),
    productId: v.id("products"),
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (args.quantity <= 0) throw new ConvexError("Transfer quantity must be greater than zero");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError("Product not found");

    if (args.fromWarehouseId) {
      const stock = await ctx.db
        .query("warehouseStock")
        .withIndex("by_warehouse_and_product", (q) =>
          q.eq("warehouseId", args.fromWarehouseId!).eq("productId", args.productId)
        )
        .unique();
      const available = stock?.quantity ?? 0;
      if (args.quantity > available) {
        throw new ConvexError(
          `Not enough stock — only ${available} units available in this warehouse`
        );
      }
      if (stock) {
        await ctx.db.patch(stock._id, { quantity: available - args.quantity });
      }
    }

    if (args.toWarehouseId) {
      const existing = await ctx.db
        .query("warehouseStock")
        .withIndex("by_warehouse_and_product", (q) =>
          q.eq("warehouseId", args.toWarehouseId!).eq("productId", args.productId)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { quantity: existing.quantity + args.quantity });
      } else {
        await ctx.db.insert("warehouseStock", {
          warehouseId: args.toWarehouseId,
          productId: args.productId,
          productName: product.name,
          quantity: args.quantity,
        });
      }
    }

    return await ctx.db.insert("warehouseTransfers", {
      fromWarehouseId: args.fromWarehouseId,
      toWarehouseId: args.toWarehouseId,
      fromStoreId: args.fromStoreId,
      toStoreId: args.toStoreId,
      productId: args.productId,
      productName: product.name,
      quantity: args.quantity,
      notes: args.notes,
      status: "completed",
      createdBy: userId ?? undefined,
    });
  },
});
