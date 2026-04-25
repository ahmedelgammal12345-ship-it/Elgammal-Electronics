import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  BadgeCheck, Plus, Pencil, Trash2, X, Check, Phone,
  Store, Users, ToggleLeft, ToggleRight, Search,
} from "lucide-react";

interface SalesmenPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

interface FormState {
  name: string;
  phone: string;
  storeId: string;
  notes: string;
  isActive: boolean;
}

const emptyForm: FormState = { name: "", phone: "", storeId: "", notes: "", isActive: true };

export default function SalesmenPage({ selectedStoreId, stores, isManager }: SalesmenPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"salesmen"> | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [filterStore, setFilterStore] = useState<string>(selectedStoreId ?? "");
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"salesmen"> | null>(null);

  const salesmen = useQuery(api.salesmen.list, {
    storeId: filterStore ? (filterStore as Id<"stores">) : undefined,
    activeOnly: showInactive ? false : true,
  });

  const createSalesman = useMutation(api.salesmen.create);
  const updateSalesman = useMutation(api.salesmen.update);
  const removeSalesman = useMutation(api.salesmen.remove);

  const filtered = (salesmen ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? "").includes(search)
  );

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, storeId: selectedStoreId ?? "" });
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditId(s._id);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      storeId: s.storeId ?? "",
      notes: s.notes ?? "",
      isActive: s.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      if (editId) {
        await updateSalesman({
          salesmanId: editId,
          name: form.name,
          phone: form.phone || undefined,
          storeId: form.storeId ? (form.storeId as Id<"stores">) : undefined,
          isActive: form.isActive,
          notes: form.notes || undefined,
        });
        toast.success("Salesman updated!");
      } else {
        await createSalesman({
          name: form.name,
          phone: form.phone || undefined,
          storeId: form.storeId ? (form.storeId as Id<"stores">) : undefined,
          notes: form.notes || undefined,
        });
        toast.success("Salesman added!");
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleDelete = async (id: Id<"salesmen">) => {
    try {
      await removeSalesman({ salesmanId: id });
      toast.success("Salesman removed");
      setConfirmDelete(null);
    } catch {
      toast.error("Failed to remove salesman");
    }
  };

  const storeName = (storeId?: string) =>
    stores.find((s) => s._id === storeId)?.name ?? "All Stores";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Salesmen</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filtered.length} salesman{filtered.length !== 1 ? "s" : ""}
            {!showInactive && " (active)"}
          </p>
        </div>
        {isManager && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Salesman
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap animate-fade-in-up stagger-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-8 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white w-56"
          />
        </div>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white"
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showInactive
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {showInactive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {showInactive ? "Showing All" : "Active Only"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in-up stagger-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-b from-violet-50 to-violet-100/50 border-b border-violet-100">
                <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Phone</th>
                <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Store</th>
                <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-violet-700 text-xs uppercase tracking-wide">Notes</th>
                {isManager && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => (
                <tr key={s._id} className="hover:bg-violet-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {s.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {s.phone}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      <Store className="w-3 h-3" />
                      {storeName(s.storeId)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                      s.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs max-w-xs truncate">
                    {s.notes || <span className="text-slate-300">—</span>}
                  </td>
                  {isManager && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(s._id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 6 : 5} className="py-16 text-center text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-7 h-7 text-violet-300" />
                    </div>
                    <p className="font-medium text-slate-500">No salesmen found</p>
                    <p className="text-xs mt-1">
                      {isManager ? "Click \"Add Salesman\" to get started" : "No salesmen have been added yet"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                  <BadgeCheck className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editId ? "Edit Salesman" : "Add Salesman"}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ahmed Hassan"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
                  autoFocus
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 01012345678"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
                />
              </div>

              {/* Store */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Assigned Store
                </label>
                <select
                  value={form.storeId}
                  onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none bg-white"
                >
                  <option value="">All Stores (Global)</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes…"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none resize-none"
                />
              </div>

              {/* Active toggle (edit only) */}
              {editId && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">Active Status</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      form.isActive
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    {form.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {form.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {editId ? "Save Changes" : "Add Salesman"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Remove Salesman?</h3>
            <p className="text-slate-500 text-sm mb-6">
              This will permanently delete this salesman. Past sales records will not be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
