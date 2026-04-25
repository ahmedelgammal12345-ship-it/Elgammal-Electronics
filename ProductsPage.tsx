import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Search, Plus, Upload, Edit2, Trash2, Package, X, Check, ChevronDown,
  Camera, Weight, ImageOff, CheckSquare, Square, Layers, Loader2, Copy
} from "lucide-react";

interface ProductForm {
  name: string;
  description: string;
  brand: string;
  category: string;
  userPrice: string;
  dealerPrice: string;
  quantity: string;
  weight: string;
  weightUnit: string;
  photoId: Id<"_storage"> | null;
}

const emptyForm: ProductForm = {
  name: "", description: "", brand: "", category: "",
  userPrice: "", dealerPrice: "", quantity: "",
  weight: "", weightUnit: "kg", photoId: null,
};

// ── Photo thumbnail component ────────────────────────────────────────────────
function ProductPhoto({ photoId, size = "sm" }: { photoId: Id<"_storage"> | undefined | null; size?: "sm" | "lg" }) {
  const url = useQuery(api.products.getPhotoUrl, photoId ? { photoId } : "skip");
  const dim = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  if (!photoId) return (
    <div className={`${dim} rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0`}>
      <Package className="w-4 h-4 text-slate-300" />
    </div>
  );
  if (url === undefined) return <div className={`${dim} rounded-lg bg-slate-100 animate-pulse flex-shrink-0`} />;
  if (!url) return (
    <div className={`${dim} rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0`}>
      <ImageOff className="w-4 h-4 text-slate-300" />
    </div>
  );
  return <img src={url} alt="product" className={`${dim} rounded-lg object-cover flex-shrink-0 border border-slate-200`} />;
}

// ── Smart Category ComboBox ──────────────────────────────────────────────────
function CategoryComboBox({ value, onChange, categories, placeholder = "Type or pick a category", required }: {
  value: string; onChange: (val: string) => void; categories: string[];
  placeholder?: string; required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputVal(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = categories.filter(c => c.toLowerCase().includes(inputVal.toLowerCase()));

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2.5 pr-8 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
        />
        <button type="button" onClick={() => setOpen(o => !o)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {inputVal && !categories.includes(inputVal) && (
            <button type="button" onMouseDown={() => { setInputVal(inputVal); onChange(inputVal); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 flex items-center gap-2 border-b border-slate-100">
              <Plus className="w-3.5 h-3.5" /> Create "{inputVal}"
            </button>
          )}
          {filtered.length > 0 ? filtered.map(cat => (
            <button key={cat} type="button" onMouseDown={() => { setInputVal(cat); onChange(cat); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${cat === value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}>
              {cat}
            </button>
          )) : (!inputVal && <p className="px-3 py-2 text-xs text-slate-400 italic">No categories yet — type to create one</p>)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ProductsPage({ isManager }: { isManager: boolean }) {
  // ── Core state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"products"> | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [importing, setImporting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  // ── Deduplication state ────────────────────────────────────────────────────
  const [showDedupModal, setShowDedupModal] = useState(false);
  const [dedupStep, setDedupStep] = useState<"idle" | "scanning" | "preview" | "deleting" | "done">("idle");
  const [dedupCount, setDedupCount] = useState(0);
  const [dedupDeleted, setDedupDeleted] = useState(0);

  // ── Share Photo state ──────────────────────────────────────────────────────
  const [shareMode, setShareMode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [shareStorageId, setShareStorageId] = useState<Id<"_storage"> | null>(null);
  const [shareUploading, setShareUploading] = useState(false);
  const [shareAssigning, setShareAssigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"products">>>(new Set());
  const shareFileRef = useRef<HTMLInputElement>(null);

  // ── Queries & mutations ────────────────────────────────────────────────────
  const hasFilter = search.trim() !== "" || selectedCategory !== "";
  const products = useQuery(
    api.products.search,
    hasFilter ? { query: search, category: selectedCategory || undefined } : "skip"
  );
  const categories = useQuery(api.products.getCategories);
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const removeProduct = useMutation(api.products.remove);
  const bulkCreate = useMutation(api.products.bulkCreate);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const bulkAssignPhotos = useMutation(api.products.bulkAssignPhotos);
  const dedupScan = useMutation(api.products.dedupScan);
  const dedupDeleteBatch = useMutation(api.products.dedupDeleteBatch);

  // ── Share Photo handlers ───────────────────────────────────────────────────
  const openShareMode = () => {
    setShareMode(true);
    setShowShareModal(true);
    setShareFile(null);
    setSharePreview(null);
    setShareStorageId(null);
    setSelectedIds(new Set());
  };

  const closeShareMode = () => {
    setShareMode(false);
    setShowShareModal(false);
    setShareFile(null);
    setSharePreview(null);
    setShareStorageId(null);
    setSelectedIds(new Set());
  };

  const handleShareFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setShareFile(f);
    setSharePreview(URL.createObjectURL(f));
    setShareStorageId(null);
    if (shareFileRef.current) shareFileRef.current.value = "";
  };

  const handleShareUpload = async () => {
    if (!shareFile) return;
    setShareUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": shareFile.type },
        body: shareFile,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();
      setShareStorageId(storageId as Id<"_storage">);
      toast.success("Photo ready! Now tick the products below to assign it.");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setShareUploading(false);
    }
  };

  const handleAssign = async () => {
    if (!shareStorageId) { toast.error("Upload the photo first"); return; }
    if (selectedIds.size === 0) { toast.error("Select at least one product"); return; }
    setShareAssigning(true);
    try {
      const assignments = Array.from(selectedIds).map((productId) => ({
        productId,
        photoId: shareStorageId,
      }));
      const count = await bulkAssignPhotos({ assignments });
      toast.success(`✅ Photo assigned to ${count} product${count !== 1 ? "s" : ""}!`);
      closeShareMode();
    } catch {
      toast.error("Failed to assign photo");
    } finally {
      setShareAssigning(false);
    }
  };

  const toggleId = (id: Id<"products">) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const visible = (products ?? []).map(p => p._id);
    const allSelected = visible.length > 0 && visible.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      return next;
    });
  };

  // ── Deduplication handlers (two-pass: scan ALL → then delete) ─────────────
  // We store the IDs to delete between the scan and the confirm step
  const [dedupIdsToDelete, setDedupIdsToDelete] = useState<string[]>([]);

  const runScan = async () => {
    setDedupStep("scanning");
    setDedupCount(0);
    setDedupIdsToDelete([]);
    try {
      const result: { toDelete: string[]; total: number } = await dedupScan({});
      setDedupIdsToDelete(result.toDelete);
      setDedupCount(result.total);
      setDedupStep("preview");
    } catch {
      toast.error("Scan failed — please try again");
      setDedupStep("idle");
    }
  };

  const runDelete = async () => {
    if (dedupIdsToDelete.length === 0) return;
    setDedupStep("deleting");
    setDedupDeleted(0);
    const BATCH = 200;
    let total = 0;
    try {
      for (let i = 0; i < dedupIdsToDelete.length; i += BATCH) {
        const batch = dedupIdsToDelete.slice(i, i + BATCH) as any[];
        const res: { deleted: number } = await dedupDeleteBatch({ ids: batch });
        total += res.deleted;
        setDedupDeleted(total);
      }
      setDedupStep("done");
      setDedupDeleted(total);
      toast.success(`✅ Deleted ${total} duplicate product${total !== 1 ? "s" : ""}!`);
    } catch {
      toast.error("Delete failed — some duplicates may remain");
      setDedupStep("idle");
    }
  };

  const openDedupModal = () => {
    setShowDedupModal(true);
    setDedupStep("idle");
    setDedupCount(0);
    setDedupDeleted(0);
    setDedupIdsToDelete([]);
  };

  const closeDedupModal = () => {
    setShowDedupModal(false);
    setDedupStep("idle");
    setDedupIdsToDelete([]);
  };

  // ── Single product photo upload ────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (rawFile.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    const ext = rawFile.name.includes(".") ? rawFile.name.slice(rawFile.name.lastIndexOf(".")) : "";
    const productName = form.name.trim().replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim() || "product";
    const renamedFilename = `${productName}${ext}`;
    const file = new File([rawFile], renamedFilename, { type: rawFile.type });

    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviewUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const json = await result.json();
      if (!result.ok) throw new Error("Upload failed");
      setForm(f => ({ ...f, photoId: json.storageId as Id<"_storage"> }));
      toast.success(`Photo saved as "${renamedFilename}"`);
    } catch {
      toast.error("Failed to upload photo");
      setPhotoPreviewUrl(null);
    } finally {
      setUploadingPhoto(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  // ── Product form submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) { toast.error("Name and category are required"); return; }
    try {
      const data = {
        name: form.name,
        description: form.description || undefined,
        brand: form.brand || undefined,
        category: form.category,
        userPrice: parseFloat(form.userPrice) || 0,
        dealerPrice: parseFloat(form.dealerPrice) || 0,
        quantity: parseInt(form.quantity) || 0,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        weightUnit: form.weight ? (form.weightUnit || "kg") : undefined,
        photoId: form.photoId ?? undefined,
      };
      if (editingId) {
        await updateProduct({ productId: editingId, ...data });
        toast.success("Product updated!");
      } else {
        await createProduct(data);
        toast.success("Product created!");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setPhotoPreviewUrl(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save product");
    }
  };

  const handleEdit = (product: any) => {
    setForm({
      name: product.name, description: product.description ?? "",
      brand: product.brand ?? "", category: product.category,
      userPrice: String(product.userPrice), dealerPrice: String(product.dealerPrice),
      quantity: String(product.quantity),
      weight: product.weight != null ? String(product.weight) : "",
      weightUnit: product.weightUnit ?? "kg",
      photoId: product.photoId ?? null,
    });
    setPhotoPreviewUrl(null);
    setEditingId(product._id);
    setShowForm(true);
  };

  const handleDelete = async (id: Id<"products">) => {
    if (!confirm("Delete this product?")) return;
    try {
      await removeProduct({ productId: id });
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete product");
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const prods = rows.filter(r => r.name || r.Name).map(r => ({
        name: String(r.name || r.Name || ""),
        description: r.description || r.Description ? String(r.description || r.Description) : undefined,
        brand: r.brand || r.Brand ? String(r.brand || r.Brand) : undefined,
        category: String(r.category || r.Category || "General"),
        userPrice: parseFloat(r["user price"] || r["userPrice"] || r["User Price"] || r.userPrice || 0),
        dealerPrice: parseFloat(r["dealer price"] || r["dealerPrice"] || r["Dealer Price"] || r.dealerPrice || 0),
        quantity: parseInt(r.quantity || r.Quantity || 0),
      }));
      if (prods.length === 0) { toast.error("No valid products found in file"); return; }
      let total = 0;
      for (let i = 0; i < prods.length; i += 100) {
        total += await bulkCreate({ products: prods.slice(i, i + 100) });
      }
      toast.success(`Imported ${total} products successfully!`);
    } catch {
      toast.error("Failed to import Excel file. Check the format.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const visibleProducts = products ?? [];
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every(p => selectedIds.has(p._id));

  return (
    <div className="p-6 space-y-5">

      {/* ── Share Photo floating panel ── */}
      {shareMode && (
        <div className="fixed bottom-6 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-violet-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Layers className="w-4 h-4" />
              <span className="font-semibold text-sm">Share Photo</span>
            </div>
            <button onClick={closeShareMode} className="text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Step 1: Pick photo */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Step 1 — Choose a photo
              </p>
              <input ref={shareFileRef} type="file" accept="image/*" className="hidden" onChange={handleShareFileSelect} />
              {sharePreview ? (
                <div className="relative">
                  <img src={sharePreview} alt="preview" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                  <button
                    onClick={() => { setShareFile(null); setSharePreview(null); setShareStorageId(null); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {shareStorageId ? (
                    <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Uploaded
                    </div>
                  ) : (
                    <button
                      onClick={handleShareUpload}
                      disabled={shareUploading}
                      className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-full font-medium flex items-center gap-1 disabled:opacity-60 transition-colors"
                    >
                      {shareUploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</> : <><Upload className="w-3 h-3" /> Upload</>}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => shareFileRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-violet-300 hover:border-violet-500 bg-violet-50 hover:bg-violet-100 flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <Camera className="w-5 h-5 text-violet-400" />
                  <span className="text-xs text-violet-500 font-medium">Click to choose photo</span>
                </button>
              )}
            </div>

            {/* Step 2: Select products */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Step 2 — Tick products in the table
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selectedIds.size > 0
                    ? <span className="text-violet-700 font-semibold">{selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    : "None selected yet"}
                </span>
                {visibleProducts.length > 0 && (
                  <button onClick={toggleAll} className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
                    {allVisibleSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
            </div>

            {/* Assign button */}
            <button
              onClick={handleAssign}
              disabled={!shareStorageId || selectedIds.size === 0 || shareAssigning}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
            >
              {shareAssigning
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning…</>
                : <><Check className="w-4 h-4" /> Assign to {selectedIds.size || "selected"} product{selectedIds.size !== 1 ? "s" : ""}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">{products?.length ?? 0} products</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? "Importing..." : "Import Excel"}
          </button>
          <button
            onClick={openDedupModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-medium transition-colors"
          >
            <Copy className="w-4 h-4" />
            Remove Duplicates
          </button>
          <button
            onClick={shareMode ? closeShareMode : openShareMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              shareMode
                ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200"
                : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
          >
            <Layers className="w-4 h-4" />
            {shareMode ? "Exit Share Mode" : "Share Photo"}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setPhotoPreviewUrl(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Excel format hint */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 animate-fade-in-up stagger-1">
        <strong>Excel Import:</strong> Columns: <code className="bg-blue-100 px-1 rounded">name, description, brand, category, user price, dealer price, quantity</code>
      </div>

      {/* Share mode banner */}
      {shareMode && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in-up">
          <Layers className="w-5 h-5 text-violet-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-violet-800">Share Photo Mode is active</p>
            <p className="text-xs text-violet-600 mt-0.5">
              1. Upload a photo in the panel (bottom-right) &nbsp;→&nbsp;
              2. Tick the products below &nbsp;→&nbsp;
              3. Click "Assign"
            </p>
          </div>
          {selectedIds.size > 0 && (
            <span className="px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-bold flex-shrink-0">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 animate-fade-in-up stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
          />
        </div>
        <div className="w-52">
          <CategoryComboBox
            value={selectedCategory}
            onChange={setSelectedCategory}
            categories={categories ?? []}
            placeholder="All Categories"
          />
        </div>
      </div>

      {/* Table */}
      {!hasFilter ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center animate-fade-in-up stagger-3">
          <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 font-medium">Search or filter to browse products</p>
          <p className="text-slate-400 text-sm mt-1">Type a product name, or pick a category from the dropdown above</p>
          {shareMode && (
            <p className="text-violet-500 text-sm mt-2 font-medium">
              🔍 Search for products first, then tick them to assign the shared photo
            </p>
          )}
        </div>
      ) : (
        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden animate-fade-in-up stagger-3 ${shareMode ? "border-violet-200" : "border-slate-100"}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                  {/* Checkbox column — only in share mode */}
                  {shareMode && (
                    <th className="px-3 py-3 w-10">
                      <button onClick={toggleAll} className="flex items-center justify-center text-slate-400 hover:text-violet-600 transition-colors" title="Select / deselect all">
                        {allVisibleSelected
                          ? <CheckSquare className="w-4 h-4 text-violet-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide w-12">Photo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Brand</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Weight</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">User Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Dealer Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Qty</th>
                  {!shareMode && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products === undefined ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={shareMode ? 9 : 9} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : visibleProducts.map((product) => {
                  const isChecked = selectedIds.has(product._id);
                  return (
                    <tr
                      key={product._id}
                      onClick={shareMode ? () => toggleId(product._id) : undefined}
                      className={`transition-colors ${shareMode ? "cursor-pointer select-none" : ""} ${
                        isChecked ? "bg-violet-50 hover:bg-violet-100" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Checkbox */}
                      {shareMode && (
                        <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); toggleId(product._id); }}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isChecked ? "bg-violet-600 border-violet-600 shadow-sm" : "border-slate-300 hover:border-violet-400"
                          }`}>
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </td>
                      )}
                      {/* Photo */}
                      <td className="px-3 py-2">
                        <ProductPhoto photoId={product.photoId} size="sm" />
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.description && <p className="text-xs text-slate-400 truncate max-w-xs">{product.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{product.brand || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs">{product.category}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {product.weight != null
                          ? <span className="inline-flex items-center gap-1"><Weight className="w-3 h-3 opacity-50" />{product.weight} {product.weightUnit ?? "kg"}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">ج.م {product.userPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">ج.م {product.dealerPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${product.quantity <= 5 ? "text-red-600" : "text-slate-900"}`}>
                          {product.quantity}
                        </span>
                      </td>
                      {/* Actions — hidden in share mode */}
                      {!shareMode && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleEdit(product)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(product._id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {products !== undefined && visibleProducts.length === 0 && (
                  <tr>
                    <td colSpan={shareMode ? 9 : 9} className="py-16 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>No products found matching your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Deduplication Modal ── */}
      {showDedupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Remove Duplicate Products</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Finds products with the exact same name</p>
                </div>
              </div>
              {dedupStep !== "deleting" && (
                <button onClick={closeDedupModal} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* idle */}
              {dedupStep === "idle" && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-amber-800">⚠️ How this works</p>
                    <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                      <li>Scans all products for exact name matches</li>
                      <li>Keeps the <strong>best</strong> copy (with photo, barcode, or description)</li>
                      <li>Permanently deletes all other duplicates</li>
                      <li>We'll show you a preview count first</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={closeDedupModal} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={runScan}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Scan for Duplicates
                    </button>
                  </div>
                </>
              )}

              {/* scanning */}
              {dedupStep === "scanning" && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Scanning all products…</p>
                    <p className="text-sm text-slate-500 mt-1">This may take a moment for large catalogs</p>
                  </div>
                </div>
              )}

              {/* preview */}
              {dedupStep === "preview" && (
                <>
                  {dedupCount === 0 ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-7 h-7 text-green-600" />
                      </div>
                      <p className="font-semibold text-slate-800">No duplicates found! 🎉</p>
                      <p className="text-sm text-slate-500">All your products have unique names.</p>
                      <button onClick={closeDedupModal} className="mt-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-red-600">{dedupCount}</p>
                        <p className="text-sm text-red-700 font-medium mt-1">
                          duplicate product{dedupCount !== 1 ? "s" : ""} found
                        </p>
                        <p className="text-xs text-red-500 mt-1">
                          The best version of each product will be kept
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                        <p>✅ <strong>Kept:</strong> Product with photo, barcode, or description</p>
                        <p>🗑️ <strong>Deleted:</strong> Incomplete duplicates with same name</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={closeDedupModal} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={runDelete}
                          className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete {dedupCount} Duplicates
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* deleting */}
              {dedupStep === "deleting" && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Deleting duplicates…</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {dedupDeleted > 0 ? `${dedupDeleted} deleted so far…` : "Please wait, do not close this window"}
                    </p>
                  </div>
                </div>
              )}

              {/* done */}
              {dedupStep === "done" && (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-7 h-7 text-green-600" />
                  </div>
                  <p className="font-bold text-slate-800 text-lg">All done! 🎉</p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-red-600">{dedupDeleted}</span> duplicate product{dedupDeleted !== 1 ? "s" : ""} permanently deleted.
                  </p>
                  <button onClick={closeDedupModal} className="mt-2 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Product Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? "Edit Product" : "Add Product"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setPhotoPreviewUrl(null); }} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Product Photo</label>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {photoPreviewUrl ? (
                      <img src={photoPreviewUrl} alt="preview" className="w-20 h-20 rounded-xl object-cover border-2 border-blue-200 shadow-sm" />
                    ) : form.photoId ? (
                      <ProductPhoto photoId={form.photoId} size="lg" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1">
                        <Camera className="w-6 h-6 text-slate-300" />
                        <span className="text-xs text-slate-300">No photo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => photoRef.current?.click()}
                      className="w-full py-2 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uploadingPhoto
                        ? <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                        : <><Camera className="w-4 h-4" /> {form.photoId || photoPreviewUrl ? "Change Photo" : "Upload Photo"}</>}
                    </button>
                    {(form.photoId || photoPreviewUrl) && (
                      <button type="button" onClick={() => { setForm(f => ({ ...f, photoId: null })); setPhotoPreviewUrl(null); }}
                        className="w-full py-1.5 px-3 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
                        Remove photo
                      </button>
                    )}
                    <p className="text-xs text-slate-400">JPG, PNG, WebP · max 5 MB</p>
                    {form.name ? (
                      <p className="text-xs text-blue-500 font-medium">
                        📸 Will be saved as: <span className="font-semibold">"{form.name.trim()}"</span>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-500">⚠ Enter the product name first so the photo is named correctly</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Product Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Brand</label>
                  <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Category *</label>
                  <CategoryComboBox value={form.category} onChange={(val) => setForm({ ...form, category: val })} categories={categories ?? []} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">User Price (ج.م)</label>
                  <input type="number" value={form.userPrice} onChange={(e) => setForm({ ...form, userPrice: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Dealer Price (ج.م)</label>
                  <input type="number" value={form.dealerPrice} onChange={(e) => setForm({ ...form, dealerPrice: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Quantity</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1"><Weight className="w-3 h-3" /> Weight</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      placeholder="0.00" className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm" step="0.001" min="0" />
                    <select value={form.weightUnit} onChange={(e) => setForm({ ...form, weightUnit: e.target.value })}
                      className="w-20 px-2 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-white">
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="lbs">lbs</option>
                      <option value="oz">oz</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setPhotoPreviewUrl(null); }}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
