import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Trash2,
  X,
  Save,
  Shield,
  ShieldCheck,
  Store,
  User,
  ChevronDown,
} from "lucide-react";

interface RoleForm {
  userId: string;
  role: "manager" | "cashier";
  storeId: string;
}

const emptyForm: RoleForm = { userId: "", role: "cashier", storeId: "" };

export default function UserRolesPage({
  stores,
}: {
  stores: Array<{ _id: Id<"stores">; name: string }>;
}) {
  const roles = useQuery(api.userRoles.list) ?? [];
  const users = useQuery(api.userRoles.listUsers) ?? [];
  const assignRole = useMutation(api.userRoles.assign);
  const removeRole = useMutation(api.userRoles.remove);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"userRoles"> | null>(null);

  // Users that don't have a role yet
  const assignedUserIds = new Set(roles.map((r) => r.userId));
  const unassignedUsers = users.filter((u) => !assignedUserIds.has(u._id));

  async function handleSave() {
    if (!form.userId) {
      toast.error("Please select a user");
      return;
    }
    setSaving(true);
    try {
      await assignRole({
        userId: form.userId as Id<"users">,
        role: form.role,
        storeId: form.storeId ? (form.storeId as Id<"stores">) : undefined,
      });
      toast.success("Role assigned successfully");
      setShowModal(false);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roleId: Id<"userRoles">) {
    setDeletingId(roleId);
    try {
      await removeRole({ roleId });
      toast.success("Role removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    } finally {
      setDeletingId(null);
    }
  }

  const managerCount = roles.filter((r) => r.role === "manager").length;
  const cashierCount = roles.filter((r) => r.role === "cashier").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            User Roles
          </h1>
          <p className="text-slate-500 mt-1">
            Assign manager or cashier roles to control access
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          Assign Role
        </button>
      </motion.div>

      {/* Role Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
      >
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Assigned</p>
          <p className="text-3xl font-bold text-slate-800">{roles.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <p className="text-sm text-slate-500">Managers</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{managerCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-slate-500">Cashiers</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{cashierCount}</p>
        </div>
      </motion.div>

      {/* Permission Reference */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 mb-8 text-white"
      >
        <h3 className="font-semibold mb-3 text-slate-200">Permission Reference</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-blue-300">Manager</span>
            </div>
            <ul className="space-y-1 text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Full access to all pages
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Create & edit products
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Manage stores & users
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                View analytics
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Adjust inventory
              </li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-emerald-300">Cashier</span>
            </div>
            <ul className="space-y-1 text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                POS Terminal (sales)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                View products
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Create quotations
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                View sales history
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 text-red-400 rounded-full bg-red-400" />
                No store/user management
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Roles List */}
      {roles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-white rounded-2xl border border-slate-200"
        >
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No roles assigned yet</h3>
          <p className="text-slate-500 mb-2">
            Users without a role have full manager access by default.
          </p>
          <p className="text-slate-400 text-sm mb-6">
            Assign roles to restrict access for cashiers.
          </p>
          <button
            onClick={() => { setForm(emptyForm); setShowModal(true); }}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
          >
            Assign First Role
          </button>
        </motion.div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Store Access
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role, i) => {
                const store = stores.find((s) => s._id === role.storeId);
                return (
                  <motion.tr
                    key={role._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {role.userName}
                          </p>
                          {role.userEmail && (
                            <p className="text-xs text-slate-400">{role.userEmail}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {role.role === "manager" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <ShieldCheck className="w-3 h-3" />
                          Manager
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <Shield className="w-3 h-3" />
                          Cashier
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {store ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          {store.name}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">All Stores</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(role._id)}
                        disabled={deletingId === role._id}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Remove role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Assign Role</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* User Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  User <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm appearance-none bg-white transition-all"
                  >
                    <option value="">Select a user...</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} {u.email ? `(${u.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {unassignedUsers.length === 0 && users.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    All users already have roles assigned. You can still reassign.
                  </p>
                )}
              </div>

              {/* Role Select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "manager" })}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      form.role === "manager"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, role: "cashier" })}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      form.role === "cashier"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Cashier
                  </button>
                </div>
              </div>

              {/* Store Access */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Store Access
                </label>
                <div className="relative">
                  <select
                    value={form.storeId}
                    onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm appearance-none bg-white transition-all"
                  >
                    <option value="">All Stores</option>
                    {stores.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Leave as "All Stores" to grant access to every store
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Assign Role"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
