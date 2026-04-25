/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as cheques from "../cheques.js";
import type * as customers from "../customers.js";
import type * as fulfillment from "../fulfillment.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as products from "../products.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as quotations from "../quotations.js";
import type * as returns from "../returns.js";
import type * as router from "../router.js";
import type * as sales from "../sales.js";
import type * as salesmen from "../salesmen.js";
import type * as seed from "../seed.js";
import type * as shifts from "../shifts.js";
import type * as stores from "../stores.js";
import type * as userRoles from "../userRoles.js";
import type * as warehouses from "../warehouses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  cheques: typeof cheques;
  customers: typeof customers;
  fulfillment: typeof fulfillment;
  http: typeof http;
  inventory: typeof inventory;
  products: typeof products;
  purchaseOrders: typeof purchaseOrders;
  quotations: typeof quotations;
  returns: typeof returns;
  router: typeof router;
  sales: typeof sales;
  salesmen: typeof salesmen;
  seed: typeof seed;
  shifts: typeof shifts;
  stores: typeof stores;
  userRoles: typeof userRoles;
  warehouses: typeof warehouses;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
