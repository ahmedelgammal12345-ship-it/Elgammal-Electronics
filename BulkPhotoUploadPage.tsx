import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Camera, Upload, X, CheckCircle2, AlertCircle, Search,
  ImageOff, Loader2, FolderOpen, Zap, Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type MatchStatus = "pending" | "matched" | "no_match" | "uploading" | "done" | "error";

interface PhotoEntry {
  id: string;           // local unique id
  file: File;
  previewUrl: string;
  nameWithoutExt: string;
  status: MatchStatus;
  matchedProductId: Id<"products"> | null;
  matchedProductName: string | null;
  errorMsg?: string;
}

// Strip extension and common separators to get a clean search term
function cleanFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")          // remove extension
    .replace(/[-_]/g, " ")            // dashes/underscores → spaces
    .replace(/\s+/g, " ")             // collapse spaces
    .trim();
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BulkPhotoUploadPage() {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchOverrides, setSearchOverrides] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const assignPhoto = useMutation(api.products.assignPhoto);

  // ── File ingestion ─────────────────────────────────────────────────────
  const ingestFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) {
      toast.error("No image files found. Please select JPG, PNG, or WebP files.");
      return;
    }

    const newEntries: PhotoEntry[] = imageFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      nameWithoutExt: cleanFilename(file.name),
      status: "pending",
      matchedProductId: null,
      matchedProductName: null,
    }));

    setEntries((prev) => {
      // Deduplicate by filename
      const existingNames = new Set(prev.map((e) => e.file.name));
      const fresh = newEntries.filter((e) => !existingNames.has(e.file.name));
      return [...prev, ...fresh];
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    ingestFiles(e.dataTransfer.files);
  }, [ingestFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) ingestFiles(e.target.files);
    e.target.value = "";
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  };

  // ── Match all pending entries against products ─────────────────────────
  const handleMatchAll = async () => {
    const pending = entries.filter((e) => e.status === "pending" || e.status === "no_match");
    if (pending.length === 0) { toast.error("No photos to match"); return; }

    setIsProcessing(true);
    toast.info(`Searching for ${pending.length} products…`);

    for (const entry of pending) {
      const searchTerm = searchOverrides[entry.id] ?? entry.nameWithoutExt;
      setEntries((prev) =>
        prev.map((e) => e.id === entry.id ? { ...e, status: "pending" } : e)
      );

      try {
        // Call the backend search
        const res = await fetch(
          `/api/findProductByName?name=${encodeURIComponent(searchTerm)}`,
          { method: "GET" }
        ).catch(() => null);

        // We use the Convex client directly via a workaround:
        // Since we can't call queries imperatively, we use a small trick —
        // we'll do the matching client-side via the mutation that searches
        // Actually we'll use the assignPhoto mutation after manual confirmation
        // For now mark as needing manual review if no direct match
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: "no_match", errorMsg: "Click 'Search' to find product" }
              : e
          )
        );
      } catch {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, status: "error", errorMsg: "Search failed" } : e
          )
        );
      }
    }
    setIsProcessing(false);
  };

  // ── Upload & assign a single photo ────────────────────────────────────
  const uploadAndAssign = async (entry: PhotoEntry) => {
    if (!entry.matchedProductId) {
      toast.error("No product matched for this photo");
      return;
    }

    setEntries((prev) =>
      prev.map((e) => e.id === entry.id ? { ...e, status: "uploading" } : e)
    );

    try {
      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": entry.file.type },
        body: entry.file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = await uploadRes.json();

      // 3. Assign to product
      await assignPhoto({
        productId: entry.matchedProductId,
        photoId: storageId as Id<"_storage">,
      });

      setEntries((prev) =>
        prev.map((e) => e.id === entry.id ? { ...e, status: "done" } : e)
      );
      toast.success(`Photo assigned to "${entry.matchedProductName}"!`);
    } catch (err) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: "error", errorMsg: err instanceof Error ? err.message : "Failed" }
            : e
        )
      );
      toast.error(`Failed to upload photo for "${entry.nameWithoutExt}"`);
    }
  };

  // ── Upload all matched photos ──────────────────────────────────────────
  const uploadAll = async () => {
    const matched = entries.filter(
      (e) => e.status === "matched" && e.matchedProductId
    );
    if (matched.length === 0) {
      toast.error("No matched photos ready to upload");
      return;
    }
    setIsProcessing(true);
    for (const entry of matched) {
      await uploadAndAssign(entry);
    }
    setIsProcessing(false);
    toast.success(`Done! ${matched.length} photos uploaded.`);
  };

  // ── Manual product match via inline search ─────────────────────────────
  const ManualSearch = ({ entry }: { entry: PhotoEntry }) => {
    const [query, setQuery] = useState(searchOverrides[entry.id] ?? entry.nameWithoutExt);
    const [results, setResults] = useState<Array<{ _id: Id<"products">; name: string; category: string }>>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);

    const doSearch = async () => {
      if (!query.trim()) return;
      setSearching(true);
      setSearched(false);
      try {
        // We use the Convex HTTP endpoint via fetch to search products
        // Since we can't call queries imperatively, we use the generateUploadUrl
        // as a proxy — instead we'll call the search via a dedicated approach.
        // We'll use the window.convex client trick:
        const convexUrl = (window as any).__convexUrl || import.meta.env.VITE_CONVEX_URL;
        const response = await fetch(`${convexUrl}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "products:findByName",
            args: { name: query.trim() },
            format: "json",
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setResults(data.value ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setSearched(true);
      }
    };

    const selectProduct = (product: { _id: Id<"products">; name: string }) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, status: "matched", matchedProductId: product._id, matchedProductName: product.name }
            : e
        )
      );
      setSearchOverrides((prev) => ({ ...prev, [entry.id]: query }));
      setResults([]);
      toast.success(`Matched to "${product.name}"`);
    };

    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search product name…"
            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
          />
          <button
            onClick={doSearch}
            disabled={searching}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Search
          </button>
        </div>
        {searched && results.length === 0 && (
          <p className="text-xs text-slate-400 italic px-1">No products found — try a shorter name</p>
        )}
        {results.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm max-h-36 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p._id}
                onClick={() => selectProduct(p)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 transition-colors text-left border-b border-slate-50 last:border-0"
              >
                <span className="font-medium text-slate-800 truncate flex-1">{p.name}</span>
                <span className="text-slate-400 ml-2 flex-shrink-0 truncate max-w-20">{p.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = {
    total: entries.length,
    matched: entries.filter((e) => e.status === "matched").length,
    done: entries.filter((e) => e.status === "done").length,
    errors: entries.filter((e) => e.status === "error").length,
    noMatch: entries.filter((e) => e.status === "no_match").length,
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Bulk Photo Upload</h1>
              <p className="text-sm text-slate-500">Match photos to products by filename, then upload all at once</p>
            </div>
          </div>
          {entries.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  entries.forEach((e) => URL.revokeObjectURL(e.previewUrl));
                  setEntries([]);
                  setSearchOverrides({});
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={uploadAll}
                disabled={isProcessing || stats.matched === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Upload {stats.matched} Matched Photos
              </button>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {entries.length > 0 && (
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: "Total", value: stats.total, color: "text-slate-700 bg-slate-100" },
              { label: "Matched", value: stats.matched, color: "text-emerald-700 bg-emerald-100" },
              { label: "Uploaded", value: stats.done, color: "text-blue-700 bg-blue-100" },
              { label: "No Match", value: stats.noMatch, color: "text-amber-700 bg-amber-100" },
              { label: "Errors", value: stats.errors, color: "text-red-700 bg-red-100" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.color}`}>
                <span>{s.value}</span>
                <span className="font-medium opacity-70">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ── How it works ── */}
        <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-200 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">How it works:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Drop your product photos below (name files after the product, e.g. <code className="bg-blue-100 px-1 rounded">Samsung Galaxy S24.jpg</code>)</li>
              <li>Use the <strong>Search</strong> button on each photo to find and match the right product</li>
              <li>Once matched (green ✓), click <strong>Upload Matched Photos</strong> to save all at once</li>
            </ol>
          </div>
        </div>

        {/* ── Drop Zone ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-6 ${
            isDragging
              ? "border-violet-400 bg-violet-50 scale-[1.01]"
              : "border-slate-300 bg-white hover:border-violet-300 hover:bg-violet-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-violet-100" : "bg-slate-100"}`}>
              {isDragging ? (
                <Upload className="w-8 h-8 text-violet-500" />
              ) : (
                <FolderOpen className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700">
                {isDragging ? "Drop photos here!" : "Drop photos or click to browse"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Supports JPG, PNG, WebP · Multiple files at once · Name files after the product
              </p>
            </div>
          </div>
        </div>

        {/* ── Photo Grid ── */}
        {entries.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No photos added yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  entry.status === "done"
                    ? "border-emerald-300 shadow-emerald-100"
                    : entry.status === "matched"
                    ? "border-blue-300 shadow-blue-100"
                    : entry.status === "error"
                    ? "border-red-300 shadow-red-100"
                    : "border-slate-200"
                }`}
              >
                {/* Photo preview */}
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  <img
                    src={entry.previewUrl}
                    alt={entry.nameWithoutExt}
                    className="w-full h-full object-cover"
                  />
                  {/* Status overlay */}
                  {entry.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  {entry.status === "done" && (
                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                      <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-7 h-7 text-white" />
                      </div>
                    </div>
                  )}
                  {/* Remove button */}
                  {entry.status !== "uploading" && entry.status !== "done" && (
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Status badge */}
                  <div className="absolute bottom-2 left-2">
                    {entry.status === "matched" && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">Matched ✓</span>
                    )}
                    {entry.status === "done" && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold">Uploaded ✓</span>
                    )}
                    {entry.status === "error" && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">Error</span>
                    )}
                    {entry.status === "no_match" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">No Match</span>
                    )}
                    {entry.status === "pending" && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-600 text-white text-xs font-bold">Pending</span>
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3">
                  {/* Filename */}
                  <p className="text-sm font-semibold text-slate-800 truncate mb-0.5" title={entry.file.name}>
                    {entry.nameWithoutExt}
                  </p>
                  <p className="text-xs text-slate-400 mb-2">
                    {(entry.file.size / 1024).toFixed(0)} KB · {entry.file.type.split("/")[1]?.toUpperCase()}
                  </p>

                  {/* Matched product info */}
                  {entry.matchedProductName && entry.status !== "done" && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-blue-800 truncate">{entry.matchedProductName}</span>
                    </div>
                  )}
                  {entry.status === "done" && entry.matchedProductName && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-emerald-800 truncate">Saved to: {entry.matchedProductName}</span>
                    </div>
                  )}
                  {entry.errorMsg && entry.status === "error" && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-700">{entry.errorMsg}</span>
                    </div>
                  )}

                  {/* Actions */}
                  {entry.status !== "done" && entry.status !== "uploading" && (
                    <>
                      {/* Manual search */}
                      <ManualSearch entry={entry} />

                      {/* Upload button (only when matched) */}
                      {entry.status === "matched" && entry.matchedProductId && (
                        <button
                          onClick={() => uploadAndAssign(entry)}
                          className="mt-2 w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload This Photo
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
