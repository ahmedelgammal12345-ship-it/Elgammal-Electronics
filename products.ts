import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { MutationCtx } from "./_generated/server";

// Internal helper: ensure a category exists in the categories table (O(1) lookup)
async function ensureCategory(ctx: MutationCtx, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_name", (q) => q.eq("name", trimmed))
    .first();
  if (!existing) {
    await ctx.db.insert("categories", { name: trimmed });
  }
}

export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    if (args.category) {
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(limit);
    }
    return await ctx.db.query("products").take(limit);
  },
});

export const search = query({
  args: {
    query: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.query.trim();

    // No query AND no category → return empty (don't load 22k products)
    if (!trimmed && !args.category) {
      return [];
    }

    // Category only (no text search) → use index, limit 200
    if (!trimmed && args.category) {
      return await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(200);
    }

    // Text search with optional category filter
    const byName = await ctx.db
      .query("products")
      .withSearchIndex("search_products", (q) => {
        let sq = q.search("name", trimmed);
        if (args.category) sq = sq.eq("category", args.category);
        return sq;
      })
      .take(64);

    const byDesc = await ctx.db
      .query("products")
      .withSearchIndex("search_by_description", (q) =>
        q.search("description", trimmed)
      )
      .take(32);

    // Merge, deduplicate, apply category filter to desc results
    const combined = [...byName];
    const ids = new Set(byName.map((p) => p._id));
    for (const p of byDesc) {
      if (!ids.has(p._id)) {
        if (!args.category || p.category === args.category) {
          combined.push(p);
        }
      }
    }

    return combined.slice(0, 80);
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    // Sole source of truth: the categories table.
    // Run repairCategories mutation once to backfill any missing entries
    // from products that were imported before ensureCategory was in place.
    const cats = await ctx.db.query("categories").collect();
    return cats.map((c) => c.name).sort();
  },
});

// Repair mutation: one paginated batch — call repeatedly until isDone=true.
// Each call reads up to 500 products and inserts missing categories.
// Returns { added, scanned, isDone, nextCursor } so the caller can loop.
export const repairCategoriesBatch = mutation({
  args: {
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Load all existing category names into a Set for O(1) lookup
    const existing = await ctx.db.query("categories").collect();
    const known = new Set(existing.map((c) => c.name.trim()));

    const PAGE = 500;
    const page = await ctx.db
      .query("products")
      .paginate({ numItems: PAGE, cursor: args.cursor });

    let added = 0;
    for (const p of page.page) {
      const cat = p.category?.trim();
      if (cat && !known.has(cat)) {
        await ctx.db.insert("categories", { name: cat });
        known.add(cat);
        added++;
      }
    }

    return {
      added,
      scanned: page.page.length,
      isDone: page.isDone,
      nextCursor: page.continueCursor,
    };
  },
});

export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

// Fast barcode lookup for POS scanner — uses search index on name as fallback
export const getByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.barcode.trim();
    if (!trimmed) return null;
    // Scan products table filtering by barcode field
    // At 22k scale this is acceptable since barcode scans are rare and targeted
    const results = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("barcode"), trimmed))
      .first();
    return results ?? null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Find products whose names fuzzy-match a given filename (for bulk photo upload)
export const findByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim().toLowerCase();
    if (!trimmed) return [];
    // Use search index for best match
    const results = await ctx.db
      .query("products")
      .withSearchIndex("search_products", (q) => q.search("name", trimmed))
      .take(5);
    return results;
  },
});

// Assign a photo (storage ID) to a product by product ID
export const assignPhoto = mutation({
  args: {
    productId: v.id("products"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, { photoId: args.photoId });
  },
});

// Bulk assign photos: array of { productId, photoId } pairs
export const bulkAssignPhotos = mutation({
  args: {
    assignments: v.array(
      v.object({
        productId: v.id("products"),
        photoId: v.id("_storage"),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const { productId, photoId } of args.assignments) {
      await ctx.db.patch(productId, { photoId });
      count++;
    }
    return count;
  },
});

export const getPhotoUrl = query({
  args: { photoId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.photoId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    brand: v.optional(v.string()),
    category: v.string(),
    userPrice: v.number(),
    dealerPrice: v.number(),
    quantity: v.number(),
    storeId: v.optional(v.id("stores")),
    barcode: v.optional(v.string()),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await ensureCategory(ctx, args.category);
    return await ctx.db.insert("products", args);
  },
});

export const bulkCreate = mutation({
  args: {
    products: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        brand: v.optional(v.string()),
        category: v.string(),
        userPrice: v.number(),
        dealerPrice: v.number(),
        quantity: v.number(),
        barcode: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const product of args.products) {
      await ensureCategory(ctx, product.category);
      await ctx.db.insert("products", product);
      count++;
    }
    return count;
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.string(),
    description: v.optional(v.string()),
    brand: v.optional(v.string()),
    category: v.string(),
    userPrice: v.number(),
    dealerPrice: v.number(),
    quantity: v.number(),
    barcode: v.optional(v.string()),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { productId, ...rest } = args;
    await ensureCategory(ctx, args.category);
    await ctx.db.patch(productId, rest);
  },
});

export const updateQuantity = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, { quantity: args.quantity });
  },
});

export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.productId);
  },
});

// ── Deduplicate products by exact name (GLOBAL two-pass) ─────────────────────
// Pass 1 (scanOnly=true):  reads ALL products, builds a name→[ids] map,
//                          returns the list of IDs to delete (does NOT delete).
// Pass 2 (scanOnly=false): receives the exact list of IDs to delete and deletes
//                          them in batches of up to 200 per call.
//
// This correctly handles duplicates that span across pagination pages.

export const dedupScan = mutation({
  args: {},
  handler: async (ctx, _args) => {
    // Collect every product (name + id + score) in one full scan
    type Row = { _id: string; name: string; score: number; _creationTime: number };
    const rows: Row[] = [];

    let cursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("products")
        .paginate({ numItems: 500, cursor });

      for (const p of page.page) {
        const score =
          (p.photoId ? 100 : 0) +
          (p.barcode ? 50 : 0) +
          (p.description ? 20 : 0) +
          (p.brand ? 10 : 0) +
          (p.quantity > 0 ? 5 : 0);
        rows.push({ _id: p._id, name: p.name.trim().toLowerCase(), score, _creationTime: p._creationTime });
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    // Group by normalised name
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name)!.push(r);
    }

    // For each group keep the best-scored (oldest on tie), collect the rest for deletion
    const toDelete: string[] = [];
    for (const [, group] of groups) {
      if (group.length <= 1) continue;
      group.sort((a, b) => b.score - a.score || a._creationTime - b._creationTime);
      for (let i = 1; i < group.length; i++) {
        toDelete.push(group[i]._id);
      }
    }

    return { toDelete, total: toDelete.length };
  },
});

export const dedupDeleteBatch = mutation({
  args: {
    ids: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const id of args.ids) {
      try {
        await ctx.db.delete(id);
        deleted++;
      } catch {
        // already deleted — skip
      }
    }
    return { deleted };
  },
});

// Bulk import: create new products or update existing ones (matched by barcode or name+category)
// Processes in batches to stay within Convex mutation limits
export const bulkImport = mutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        brand: v.optional(v.string()),
        category: v.string(),
        userPrice: v.number(),
        dealerPrice: v.number(),
        quantity: v.number(),
        barcode: v.optional(v.string()),
        storeId: v.optional(v.id("stores")),
        weight: v.optional(v.number()),
        weightUnit: v.optional(v.string()),
        mode: v.union(v.literal("create"), v.literal("update_qty"), v.literal("update_all")),
      })
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.rows) {
      await ensureCategory(ctx, row.category);

      // Try to find existing product by barcode first, then by name+category
      let existing = null;
      if (row.barcode) {
        existing = await ctx.db
          .query("products")
          .filter((q) => q.eq(q.field("barcode"), row.barcode))
          .first();
      }
      if (!existing) {
        existing = await ctx.db
          .query("products")
          .withIndex("by_category", (q) => q.eq("category", row.category))
          .filter((q) => q.eq(q.field("name"), row.name))
          .first();
      }

      if (existing) {
        if (row.mode === "update_qty") {
          await ctx.db.patch(existing._id, { quantity: row.quantity });
          updated++;
        } else if (row.mode === "update_all") {
          await ctx.db.patch(existing._id, {
            name: row.name,
            description: row.description,
            brand: row.brand,
            category: row.category,
            userPrice: row.userPrice,
            dealerPrice: row.dealerPrice,
            quantity: row.quantity,
            barcode: row.barcode,
            weight: row.weight,
            weightUnit: row.weightUnit,
          });
          updated++;
        } else {
          // mode === "create" but product exists → skip
          skipped++;
        }
      } else {
        // Product not found → create it
        await ctx.db.insert("products", {
          name: row.name,
          description: row.description,
          brand: row.brand,
          category: row.category,
          userPrice: row.userPrice,
          dealerPrice: row.dealerPrice,
          quantity: row.quantity,
          barcode: row.barcode,
          storeId: row.storeId,
          weight: row.weight,
          weightUnit: row.weightUnit,
        });
        created++;
      }
    }

    return { created, updated, skipped };
  },
});
