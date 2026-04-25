import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X, Tag, Check } from "lucide-react";

interface CategoryDropdownProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  /** compact = smaller trigger button (for tight layouts like POS/Quotations) */
  compact?: boolean;
}

/**
 * CategoryDropdown — handles 300+ categories gracefully.
 *
 * UX pattern:
 *  - Trigger button shows "All Categories" or the selected category name
 *  - Clicking opens a floating panel with a search input + scrollable list
 *  - Selecting a category closes the panel and shows the selection as a pill
 *  - Clicking the × on the pill clears the selection
 *  - Clicking outside closes the panel
 */
export default function CategoryDropdown({
  categories,
  selectedCategory,
  onSelectCategory,
  compact = false,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = search.trim()
    ? categories.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const handleSelect = (cat: string) => {
    onSelectCategory(cat === selectedCategory ? "" : cat);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCategory("");
    setOpen(false);
    setSearch("");
  };

  const py = compact ? "py-1.5" : "py-2";
  const px = compact ? "px-2.5" : "px-3";
  const textSize = compact ? "text-xs" : "text-sm";

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 ${px} ${py} rounded-lg border transition-all ${textSize} font-medium max-w-full ${
          selectedCategory
            ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        <Tag className={`flex-shrink-0 ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
        <span className="truncate max-w-[160px]">
          {selectedCategory || "All Categories"}
        </span>
        {selectedCategory ? (
          <span
            role="button"
            onClick={handleClear}
            className="flex-shrink-0 ml-0.5 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
          >
            <X className={`${compact ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
          </span>
        ) : (
          <ChevronDown
            className={`flex-shrink-0 transition-transform ${compact ? "w-3 h-3" : "w-3.5 h-3.5"} ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl w-72 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${categories.length} categories…`}
                className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Count badge */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {filtered.length} of {categories.length} categories
            </span>
            {selectedCategory && (
              <button
                onClick={handleClear}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* "All" option */}
          <button
            onClick={() => handleSelect("")}
            className={`flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors border-b border-slate-50 ${
              !selectedCategory
                ? "bg-blue-50 text-blue-700"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>All Categories</span>
            {!selectedCategory && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {/* Category list */}
          <div className="overflow-y-auto max-h-64" style={{ scrollbarWidth: "thin" }}>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No categories match "{search}"
              </div>
            ) : (
              filtered.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSelect(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors border-b border-slate-50 last:border-0 ${
                    selectedCategory === cat
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate text-left">{cat}</span>
                  {selectedCategory === cat && (
                    <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
