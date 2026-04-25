import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

// Get the current user's role
export const myRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const role = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return role ?? null;
  },
});

// List all user roles (manager only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("userRoles").collect();
    // Enrich with user info
    const enriched = await Promise.all(
      roles.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          userName: user?.name ?? user?.email ?? "Unknown User",
          userEmail: user?.email ?? "",
        };
      })
    );
    return enriched;
  },
});

// List all users from auth tables
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(200);
    return users.map((u) => ({
      _id: u._id,
      name: u.name ?? u.email ?? "Unknown",
      email: u.email ?? "",
    }));
  },
});

// Assign or update a role
export const assign = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("manager"), v.literal("cashier")),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const assignedBy = await getAuthUserId(ctx);

    // Check if role already exists for this user
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        storeId: args.storeId,
        assignedBy: assignedBy ?? undefined,
      });
    } else {
      await ctx.db.insert("userRoles", {
        userId: args.userId,
        role: args.role,
        storeId: args.storeId,
        assignedBy: assignedBy ?? undefined,
      });
    }
  },
});

// Remove a role assignment
export const remove = mutation({
  args: { roleId: v.id("userRoles") },
  handler: async (ctx, args) => {
    const assignedBy = await getAuthUserId(ctx);
    if (!assignedBy) throw new ConvexError("You must be signed in to manage roles");
    await ctx.db.delete(args.roleId);
  },
});
