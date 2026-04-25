import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedStores = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("stores").first();
    if (existing) return "Stores already seeded";

    const stores = [
      { name: "الفرع الرئيسي - المعادي", address: "شارع النصر، المعادي، القاهرة", phone: "02-25200101" },
      { name: "فرع مدينة نصر", address: "شارع عباس العقاد، مدينة نصر، القاهرة", phone: "02-24020102" },
      { name: "فرع الإسكندرية", address: "شارع الجيش، سيدي جابر، الإسكندرية", phone: "03-54670103" },
      { name: "فرع الجيزة", address: "شارع الهرم، الجيزة", phone: "02-35720104" },
    ];

    for (const store of stores) {
      await ctx.db.insert("stores", store);
    }
    return "4 stores created";
  },
});

export const updateStoreInfo = mutation({
  args: {},
  handler: async (ctx) => {
    const stores = await ctx.db.query("stores").collect();
    if (stores.length === 0) return "No stores found — run seedStores first";

    const storeData = [
      {
        name: "الفرع الرئيسي - المعادي",
        address: "شارع النصر، المعادي، القاهرة 11431",
        phone: "02-25200101",
        email: "maadi@posstore.eg",
        taxNumber: "TAX-EG-001-2024",
        website: "www.posstore.eg",
      },
      {
        name: "فرع مدينة نصر",
        address: "شارع عباس العقاد، مدينة نصر، القاهرة 11765",
        phone: "02-24020102",
        email: "nasr@posstore.eg",
        taxNumber: "TAX-EG-002-2024",
        website: "www.posstore.eg",
      },
      {
        name: "فرع الإسكندرية",
        address: "شارع الجيش، سيدي جابر، الإسكندرية 21523",
        phone: "03-54670103",
        email: "alex@posstore.eg",
        taxNumber: "TAX-EG-003-2024",
        website: "www.posstore.eg",
      },
      {
        name: "فرع الجيزة",
        address: "شارع الهرم، الجيزة 12511",
        phone: "02-35720104",
        email: "giza@posstore.eg",
        taxNumber: "TAX-EG-004-2024",
        website: "www.posstore.eg",
      },
    ];

    let updated = 0;
    for (let i = 0; i < stores.length && i < storeData.length; i++) {
      await ctx.db.patch(stores[i]._id, storeData[i]);
      updated++;
    }

    return `Updated ${updated} stores with full Egyptian store information`;
  },
});
