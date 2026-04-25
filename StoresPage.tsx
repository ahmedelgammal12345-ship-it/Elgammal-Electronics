import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Store,
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Phone,
  Save,
  Building2,
} from "lucide-react";

interface StoreForm {
  name: string;
  address: string;
  phone: string;
}

const emptyForm: StoreForm = { name: "", address: "", phone: "" };

export default function StoresPage() {
  const stores = useQuery(api.stores.list) ?? [];
  const createStore = useMutation(api.stores.create);
  const updateStore = useMutation(api.stores.update);
  const removeStore = useMutation(api.stores.remove);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<Id<"stores"> | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"stores"> | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(store: { _id: Id<"stores">; name: string; address?: string; phone?: string }) {
    setEditingId(store._id);
    setForm({
      name: store.name,
      address: store.address ?? "",
      phone: store.phone ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Store name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateStore({
          storeId: editingId,
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });
        toast.success("Store updated successfully");
      } else {
        await createStore({
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
        });
        toast.success("Store created successfully");
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save store");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(storeId: Id<"stores">) {
    setDeletingId(storeId);
    try {
      await removeStore({ storeId });
      toast.success("Store deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete store");
    } finally {
      setDeletingId(null);
    }
  }

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
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Store Management
          </h1>
          <p className="text-slate-500 mt-1 ml-13">
            Manage your store locations, addresses, and contact info
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Store
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-4 mb-8"
      >
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Stores</p>
          <p className="text-3xl font-bold text-slate-800">{stores.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">With Address</p>
          <p className="text-3xl font-bold text-slate-800">
            {stores.filter((s) => s.address).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">With Phone</p>
          <p className="text-3xl font-bold text-slate-800">
            {stores.filter((s) => s.phone).length}
          </p>
        </div>
      </motion.div>

      {/* Store Cards */}
      {stores.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-white rounded-2xl border border-slate-200"
        >
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No stores yet</h3>
          <p className="text-slate-500 mb-6">Add your first store to get started</p>
          <button
            onClick={openCreate}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Add First Store
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {stores.map((store, i) => (
            <motion.div
              key={store._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                    <Store className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{store.name}</h3>
                    <div className="mt-2 space-y-1">
                      {store.address ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{store.address}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>No address set</span>
                        </div>
                      )}
                      {store.phone ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{store.phone}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                          <Phone className="w-3.5 h-3.5" />
                          <span>No phone set</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(store)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit store"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(store._id)}
                    disabled={deletingId === store._id}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Delete store"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? "Edit Store" : "Add New Store"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Main Branch"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Address
                  </span>
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. 123 Main St, City"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +1 555 000 0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                />
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Store"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
