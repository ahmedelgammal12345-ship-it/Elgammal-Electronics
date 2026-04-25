import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {
  stores: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    salePrefix: v.optional(v.string()),
  }),

  categories: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  products: defineTable({
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
  })
    .index("by_category", ["category"])
    .index("by_store", ["storeId"])
    .index("by_quantity", ["quantity"])
    .index("by_store_and_quantity", ["storeId", "quantity"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["category"],
    })
    .searchIndex("search_by_description", {
      searchField: "description",
    }),

  sales: defineTable({
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
    specialDiscount: v.optional(v.number()), // fixed EGP amount off
    taxRate: v.optional(v.number()),         // e.g. 14 for 14%
    taxAmount: v.optional(v.number()),       // computed tax amount in EGP
    total: v.number(),
    paymentType: v.union(v.literal("cash"), v.literal("credit"), v.literal("phone_transfer"), v.literal("cheque")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    salesmanName: v.optional(v.string()),
    // Cheque payment details (stored on sale for receipt display)
    chequeNumber: v.optional(v.string()),
    bankName: v.optional(v.string()),
    chequeHolderName: v.optional(v.string()),
    chequeDueDate: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("pending"), v.literal("cancelled")),
    createdBy: v.optional(v.id("users")),
    shiftId: v.optional(v.id("shifts")),
    seqNumber: v.optional(v.number()),
    saleNumber: v.optional(v.string()),
    // Partial payment / deposit fields
    deposit: v.optional(v.number()),         // initial deposit paid
    amountPaid: v.optional(v.number()),      // total paid so far (deposit + subsequent payments)
    remainingBalance: v.optional(v.number()), // total - amountPaid
  })
    .index("by_store", ["storeId"])
    .index("by_payment_type", ["paymentType"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_customer", ["customerId"])
    .index("by_shift", ["shiftId"])
    .index("by_seq_number", ["seqNumber"])
    .index("by_store_and_seq", ["storeId", "seqNumber"])
    .searchIndex("search_by_sale_number", { searchField: "saleNumber" }),

  quotations: defineTable({
    storeId: v.id("stores"),
    customerId: v.optional(v.id("customers")),
    quotationNumber: v.string(),
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
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("accepted"), v.literal("rejected")),
    validUntil: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    seqNumber: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_status", ["status"])
    .index("by_seq_number", ["seqNumber"])
    .index("by_customer", ["customerId"]),

  inventoryAdjustments: defineTable({
    storeId: v.id("stores"),
    productId: v.id("products"),
    productName: v.string(),
    type: v.union(
      v.literal("add"),
      v.literal("remove"),
      v.literal("set"),
      v.literal("damage"),
      v.literal("return")
    ),
    quantityBefore: v.number(),
    quantityChange: v.number(),
    quantityAfter: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_store", ["storeId"])
    .index("by_product", ["productId"])
    .index("by_store_and_product", ["storeId", "productId"]),

  userRoles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("manager"), v.literal("cashier")),
    storeId: v.optional(v.id("stores")),
    assignedBy: v.optional(v.id("users")),
  })
    .index("by_user", ["userId"])
    .index("by_store", ["storeId"])
    .index("by_user_and_store", ["userId", "storeId"]),

  customers: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    loyaltyPoints: v.number(),
    loyaltyDiscount: v.number(),
    totalSpent: v.number(),
    totalOrders: v.number(),
    notes: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
  })
    .index("by_store", ["storeId"])
    .index("by_phone", ["phone"])
    .searchIndex("search_customers", { searchField: "name" }),

  purchaseOrders: defineTable({
    storeId: v.id("stores"),
    poNumber: v.string(),
    supplierName: v.string(),
    supplierPhone: v.optional(v.string()),
    supplierEmail: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        orderedQty: v.number(),
        receivedQty: v.number(),
        unitCost: v.number(),
        total: v.number(),
      })
    ),
    subtotal: v.number(),
    shippingCost: v.optional(v.number()),
    totalCost: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("ordered"),
      v.literal("partial"),
      v.literal("received"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    expectedDate: v.optional(v.string()),
    receivedDate: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    seqNumber: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_seq_number", ["seqNumber"]),

  returns: defineTable({
    storeId: v.id("stores"),
    saleId: v.optional(v.id("sales")),
    returnNumber: v.string(),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
        reason: v.string(),
        condition: v.union(
          v.literal("resalable"),
          v.literal("damaged"),
          v.literal("defective")
        ),
        restockQty: v.number(),
      })
    ),
    totalRefund: v.number(),
    refundMethod: v.union(
      v.literal("cash"),
      v.literal("credit"),
      v.literal("store_credit"),
      v.literal("exchange")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("completed")
    ),
    notes: v.optional(v.string()),
    processedBy: v.optional(v.id("users")),
    seqNumber: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_sale", ["saleId"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_seq_number", ["seqNumber"]),

  shifts: defineTable({
    storeId: v.id("stores"),
    openedBy: v.id("users"),
    closedBy: v.optional(v.id("users")),
    openingFloat: v.number(),
    closingFloat: v.optional(v.number()),
    expectedCash: v.optional(v.number()),
    cashVariance: v.optional(v.number()),
    totalCashSales: v.optional(v.number()),
    totalCreditSales: v.optional(v.number()),
    totalSales: v.optional(v.number()),
    totalTransactions: v.optional(v.number()),
    totalRefunds: v.optional(v.number()),
    notes: v.optional(v.string()),
    closingNotes: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("closed")),
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_opened_by", ["openedBy"]),

  salesmen: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_store", ["storeId"])
    .index("by_active", ["isActive"])
    .index("by_store_and_active", ["storeId", "isActive"])
    .searchIndex("search_salesmen", { searchField: "name" }),

  warehouses: defineTable({
    name: v.string(),
    code: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    managerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    storeId: v.optional(v.id("stores")),
  })
    .index("by_store", ["storeId"])
    .index("by_active", ["isActive"])
    .searchIndex("search_warehouses", { searchField: "name" }),

  warehouseStock: defineTable({
    warehouseId: v.id("warehouses"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    minQuantity: v.optional(v.number()),
  })
    .index("by_warehouse", ["warehouseId"])
    .index("by_product", ["productId"])
    .index("by_warehouse_and_product", ["warehouseId", "productId"]),

  warehouseTransfers: defineTable({
    fromWarehouseId: v.optional(v.id("warehouses")),
    toWarehouseId: v.optional(v.id("warehouses")),
    fromStoreId: v.optional(v.id("stores")),
    toStoreId: v.optional(v.id("stores")),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.number(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("cancelled")),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_from_warehouse", ["fromWarehouseId"])
    .index("by_to_warehouse", ["toWarehouseId"])
    .index("by_product", ["productId"])
    .index("by_status", ["status"]),

  // Warehouse-to-Store fulfillment requests
  fulfillmentRequests: defineTable({
    requestNumber: v.string(),
    storeId: v.id("stores"),
    storeName: v.string(),
    warehouseId: v.id("warehouses"),
    warehouseName: v.string(),
    items: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        requestedQty: v.number(),
        fulfilledQty: v.optional(v.number()),
        warehouseStock: v.optional(v.number()),
      })
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("partially_fulfilled"),
      v.literal("fulfilled"),
      v.literal("cancelled")
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("urgent")),
    notes: v.optional(v.string()),
    fulfillmentNotes: v.optional(v.string()),
    requestedBy: v.optional(v.id("users")),
    fulfilledBy: v.optional(v.id("users")),
    fulfilledAt: v.optional(v.number()),
    seqNumber: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_warehouse", ["warehouseId"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_seq_number", ["seqNumber"]),

  // Cheque records linked to sales
  cheques: defineTable({
    saleId: v.id("sales"),
    saleNumber: v.optional(v.string()),
    storeId: v.id("stores"),
    chequeNumber: v.string(),
    bankName: v.string(),
    chequeHolderName: v.string(),
    amount: v.number(),
    dueDate: v.string(),           // ISO date string "YYYY-MM-DD"
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
      v.literal("bounced")
    ),
    notes: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    confirmedBy: v.optional(v.id("users")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
  })
    .index("by_store", ["storeId"])
    .index("by_sale", ["saleId"])
    .index("by_status", ["status"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_due_date", ["dueDate"])
    .index("by_store_and_due_date", ["storeId", "dueDate"])
    .searchIndex("search_cheques", { searchField: "chequeNumber" }),

  shiftEvents: defineTable({
    shiftId: v.id("shifts"),
    storeId: v.id("stores"),
    type: v.union(
      v.literal("cash_in"),
      v.literal("cash_out"),
      v.literal("note")
    ),
    amount: v.optional(v.number()),
    reason: v.string(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_shift", ["shiftId"])
    .index("by_store", ["storeId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
