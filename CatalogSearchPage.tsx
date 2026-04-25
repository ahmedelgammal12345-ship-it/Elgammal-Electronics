import { useState, useEffect, useRef } from "react";
// useRef kept for inputRef (search input autofocus)
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import CategoryDropdown from "./CategoryDropdown";
import {
  Search,
  Package,
  Tag,
  DollarSign,
  X,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Product photo thumbnail (resolves storage URL) ────────────────────────────
function ProductThumb({ photoId }: { photoId: Id<"_storage"> | undefined | null }) {
  const url = useQuery(api.products.getPhotoUrl, photoId ? { photoId } : "skip");
  if (!photoId) return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      <Package className="w-4 h-4 text-slate-300" />
    </div>
  );
  if (url === undefined) return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
  );
  if (!url) return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
      <Package className="w-4 h-4 text-slate-300" />
    </div>
  );
  return (
    <img src={url} alt="product" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200" />
  );
}

// ── Lightbox modal ────────────────────────────────────────────────────────────
function PhotoLightbox({
  photoId,
  productName,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  photoId: Id<"_storage">;
  productName: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const url = useQuery(api.products.getPhotoUrl, { photoId });

  // Close on Escape, navigate with arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-3xl max-h-[85vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {url === undefined ? (
          <div className="w-80 h-80 bg-white/10 rounded-2xl animate-pulse" />
        ) : url ? (
          <img
            src={url}
            alt={productName}
            className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl"
          />
        ) : (
          <div className="w-80 h-80 bg-white/10 rounded-2xl flex items-center justify-center">
            <Package className="w-16 h-16 text-white/30" />
          </div>
        )}
        <p className="text-white font-semibold text-lg text-center drop-shadow">{productName}</p>
      </div>
    </div>
  );
}

// ── Stock status badge ────────────────────────────────────────────────────────
function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" /> Out of Stock
      </span>
    );
  if (qty <= 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
        <TrendingDown className="w-3 h-3" /> Critical ({qty})
      </span>
    );
  if (qty <= 10)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <TrendingDown className="w-3 h-3" /> Low ({qty})
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle className="w-3 h-3" /> In Stock ({qty})
    </span>
  );
}

// ── Sort options ──────────────────────────────────────────────────────────────
type SortKey = "name" | "userPrice" | "dealerPrice" | "quantity";
type SortDir = "asc" | "desc";

// ── Main component ────────────────────────────────────────────────────────────
export default function CatalogSearchPage() {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showDealerPrice, setShowDealerPrice] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useQuery(api.products.getCategories) ?? [];

  // categorySearch is now internal to CategoryDropdown

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const results = useQuery(
    api.products.search,
    debouncedSearch || selectedCategory
      ? { query: debouncedSearch, category: selectedCategory || undefined }
      : "skip"
  );

  // Sort results client-side
  const sorted = [...(results ?? [])].sort((a, b) => {
    let av: string | number = a[sortKey] ?? 0;
    let bv: string | number = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <BarChart2 className="w-3.5 h-3.5 text-slate-300" />;
    return sortDir === "asc"
      ? <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
      : <TrendingDown className="w-3.5 h-3.5 text-blue-500" />;
  };

  const clearSearch = () => {
    setSearchText("");
    setDebouncedSearch("");
    setSelectedCategory("");
    inputRef.current?.focus();
  };

  const hasSearch = debouncedSearch || selectedCategory;
  const isLoading = hasSearch && results === undefined;

  // Stats from results
  const totalValue = sorted.reduce((s, p) => s + p.userPrice * p.quantity, 0);
  const outOfStock = sorted.filter((p) => p.quantity === 0).length;
  const lowStock = sorted.filter((p) => p.quantity > 0 && p.quantity <= 10).length;

  // Products with photos only (for lightbox navigation)
  const photoproducts = sorted.filter((p) => p.photoId);

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && photoproducts[lightboxIdx] && (
        <PhotoLightbox
          photoId={photoproducts[lightboxIdx].photoId as Id<"_storage">}
          productName={photoproducts[lightboxIdx].name}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightboxIdx((i) => (i !== null && i < photoproducts.length - 1 ? i + 1 : i))}
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < photoproducts.length - 1}
        />
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Search across all products — prices, stock levels, and details
            </p>
          </div>
          {/* Dealer price toggle */}
          <button
            onClick={() => setShowDealerPrice(!showDealerPrice)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
              showDealerPrice
                ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-purple-400"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            {showDealerPrice ? "Showing Dealer Price" : "Show Dealer Price"}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by product name or description…"
            className="w-full pl-12 pr-10 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all bg-white"
            autoFocus
          />
          {searchText && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filter — dropdown handles 300+ categories */}
        <div className="mt-3">
          <CategoryDropdown
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">
        {/* Empty / prompt state */}
        {!hasSearch && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Search the Catalog</h2>
            <p className="text-slate-400 max-w-sm">
              Type a product name or description above, or pick a category to browse. Prices and stock levels update in real time.
            </p>
            <div className="mt-6 flex gap-3 flex-wrap justify-center">
              {categories.slice(0, 6).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                >
                  {cat}
                </button>
              ))}
              {categories.length > 6 && (
                <span className="px-4 py-2 text-sm text-slate-400">+{categories.length - 6} more</span>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
                <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
                <div className="w-24 h-8 bg-slate-200 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {hasSearch && !isLoading && (
          <>
            {/* Stats bar */}
            {sorted.length > 0 && (
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">{sorted.length}</span> product{sorted.length !== 1 ? "s" : ""} found
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-sm text-slate-500">
                  Total value:{" "}
                  <span className="font-semibold text-slate-800">
                    ج.م{totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                {outOfStock > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-sm text-red-600 font-medium">{outOfStock} out of stock</span>
                  </>
                )}
                {lowStock > 0 && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-sm text-yellow-600 font-medium">{lowStock} low stock</span>
                  </>
                )}
              </div>
            )}

            {/* Table */}
            {sorted.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
                      <th className="text-left px-4 py-3">
                        <button
                          onClick={() => toggleSort("name")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
                        >
                          Product <SortIcon k="name" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                        Category
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                        Brand
                      </th>
                      <th className="text-right px-4 py-3">
                        <button
                          onClick={() => toggleSort("userPrice")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors ml-auto"
                        >
                          User Price <SortIcon k="userPrice" />
                        </button>
                      </th>
                      {showDealerPrice && (
                        <th className="text-right px-4 py-3">
                          <button
                            onClick={() => toggleSort("dealerPrice")}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-500 uppercase tracking-wider hover:text-purple-700 transition-colors ml-auto"
                          >
                            Dealer Price <SortIcon k="dealerPrice" />
                          </button>
                        </th>
                      )}
                      <th className="text-right px-4 py-3">
                        <button
                          onClick={() => toggleSort("quantity")}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors ml-auto"
                        >
                          Stock <SortIcon k="quantity" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((product, idx) => {
                      const isSelected = selectedProduct === product._id;
                      const margin = product.userPrice > 0
                        ? (((product.userPrice - product.dealerPrice) / product.userPrice) * 100).toFixed(1)
                        : "0.0";
                      return (
                        <>
                          <tr
                            key={product._id}
                            onClick={() => setSelectedProduct(isSelected ? null : product._id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {/* Photo thumbnail — click to open lightbox */}
                                {product.photoId ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const photoIdx = photoproducts.findIndex((p) => p._id === product._id);
                                      if (photoIdx !== -1) setLightboxIdx(photoIdx);
                                    }}
                                    className="relative group flex-shrink-0"
                                    title="Click to enlarge photo"
                                  >
                                    <ProductThumb photoId={product.photoId as Id<"_storage">} />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
                                      <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    product.quantity === 0 ? "bg-red-100"
                                    : product.quantity <= 3 ? "bg-orange-100"
                                    : product.quantity <= 10 ? "bg-yellow-100"
                                    : "bg-blue-100"
                                  }`}>
                                    <Package className={`w-4 h-4 ${
                                      product.quantity === 0 ? "text-red-500"
                                      : product.quantity <= 3 ? "text-orange-500"
                                      : product.quantity <= 10 ? "text-yellow-600"
                                      : "text-blue-500"
                                    }`} />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-slate-800">{product.name}</div>
                                  {product.description && (
                                    <div className="text-xs text-slate-400 truncate max-w-xs">{product.description}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                                <Tag className="w-3 h-3" />
                                {product.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                              {product.brand || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-slate-800">
                                ج.م{product.userPrice.toFixed(2)}
                              </span>
                            </td>
                            {showDealerPrice && (
                              <td className="px-4 py-3 text-right">
                                <span className="font-semibold text-purple-700">
                                  ج.م{product.dealerPrice.toFixed(2)}
                                </span>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <StockBadge qty={product.quantity} />
                            </td>
                          </tr>
                          {/* Expanded detail row */}
                          {isSelected && (
                            <tr key={`${product._id}-detail`} className="bg-blue-50 border-b border-blue-100">
                              <td colSpan={showDealerPrice ? 7 : 6} className="px-6 py-4">
                                <div className="flex gap-5">
                                  {/* Large photo in detail panel */}
                                  {product.photoId && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const photoIdx = photoproducts.findIndex((p) => p._id === product._id);
                                        if (photoIdx !== -1) setLightboxIdx(photoIdx);
                                      }}
                                      className="relative group flex-shrink-0"
                                      title="Click to enlarge"
                                    >
                                      <ProductThumb photoId={product.photoId as Id<"_storage">} />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-colors flex items-center justify-center">
                                        <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </button>
                                  )}
                                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-xl p-3 border border-blue-100">
                                      <div className="text-xs text-slate-500 mb-1">User Price</div>
                                      <div className="text-lg font-bold text-slate-800">ج.م{product.userPrice.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-purple-100">
                                      <div className="text-xs text-slate-500 mb-1">Dealer Price</div>
                                      <div className="text-lg font-bold text-purple-700">ج.م{product.dealerPrice.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-green-100">
                                      <div className="text-xs text-slate-500 mb-1">Margin</div>
                                      <div className="text-lg font-bold text-green-700">{margin}%</div>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-slate-100">
                                      <div className="text-xs text-slate-500 mb-1">Stock Value</div>
                                      <div className="text-lg font-bold text-slate-800">
                                        ج.م{(product.userPrice * product.quantity).toFixed(2)}
                                      </div>
                                    </div>
                                    {product.barcode && (
                                      <div className="bg-white rounded-xl p-3 border border-slate-100 col-span-2">
                                        <div className="text-xs text-slate-500 mb-1">Barcode</div>
                                        <div className="font-mono text-sm text-slate-700">{product.barcode}</div>
                                      </div>
                                    )}
                                    {product.description && (
                                      <div className="bg-white rounded-xl p-3 border border-slate-100 col-span-2 md:col-span-4">
                                        <div className="text-xs text-slate-500 mb-1">Description</div>
                                        <div className="text-sm text-slate-700">{product.description}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* No results */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No products found</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Try a different search term or category
                </p>
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Clear Search
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
