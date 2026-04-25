import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Download,
  RefreshCw,
  ArrowRight,
  Info,
  Loader2,
  Table2,
  Zap,
} from "lucide-react";

interface ProductImportPageProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

type ImportMode = "create" | "update_qty" | "update_all";

interface RawRow {
  [key: string]: string | number | undefined;
}

interface MappedRow {
  name: string;
  category: string;
  userPrice: number;
  dealerPrice: number;
  quantity: number;
  description?: string;
  brand?: string;
  barcode?: string;
  storeId?: Id<"stores">;
  mode: ImportMode;
  // validation
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
}

interface ColumnMapping {
  name: string;
  category: string;
  userPrice: string;
  dealerPrice: string;
  quantity: string;
  description: string;
  brand: string;
  barcode: string;
}

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["name", "category", "userPrice", "dealerPrice", "quantity"];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  name: "Product Name *",
  category: "Category *",
  userPrice: "User Price (EGP) *",
  dealerPrice: "Dealer Price (EGP) *",
  quantity: "Quantity *",
  description: "Description",
  brand: "Brand",
  barcode: "Barcode",
};

const COMMON_ALIASES: Record<keyof ColumnMapping, string[]> = {
  name: ["name", "product name", "product", "item", "item name", "اسم المنتج", "المنتج"],
  category: ["category", "cat", "type", "group", "الفئة", "التصنيف"],
  userPrice: ["user price", "userprice", "price", "retail price", "selling price", "سعر المستخدم", "السعر"],
  dealerPrice: ["dealer price", "dealerprice", "cost", "wholesale", "سعر الموزع", "التكلفة"],
  quantity: ["quantity", "qty", "stock", "units", "الكمية", "المخزون"],
  description: ["description", "desc", "details", "الوصف"],
  brand: ["brand", "manufacturer", "make", "العلامة التجارية", "الماركة"],
  barcode: ["barcode", "sku", "code", "upc", "ean", "الباركود", "الكود"],
};

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: "", category: "", userPrice: "", dealerPrice: "",
    quantity: "", description: "", brand: "", barcode: "",
  };
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const field of Object.keys(mapping) as (keyof ColumnMapping)[]) {
    const aliases = COMMON_ALIASES[field];
    for (const alias of aliases) {
      const idx = lowerHeaders.findIndex((h) => h === alias || h.includes(alias));
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

function parseNumber(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function validateAndMap(
  rawRows: RawRow[],
  mapping: ColumnMapping,
  mode: ImportMode,
  storeId: Id<"stores"> | null
): MappedRow[] {
  return rawRows.map((row, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = String(row[mapping.name] ?? "").trim();
    const category = String(row[mapping.category] ?? "").trim();
    const userPriceRaw = parseNumber(row[mapping.userPrice]);
    const dealerPriceRaw = parseNumber(row[mapping.dealerPrice]);
    const quantityRaw = parseNumber(row[mapping.quantity]);

    if (!name) errors.push("Product name is required");
    if (!category) errors.push("Category is required");
    if (userPriceRaw === null) errors.push("User price is required and must be a number");
    if (dealerPriceRaw === null) errors.push("Dealer price is required and must be a number");
    if (quantityRaw === null) errors.push("Quantity is required and must be a number");

    if (userPriceRaw !== null && userPriceRaw < 0) errors.push("User price cannot be negative");
    if (dealerPriceRaw !== null && dealerPriceRaw < 0) errors.push("Dealer price cannot be negative");
    if (quantityRaw !== null && quantityRaw < 0) errors.push("Quantity cannot be negative");
    if (userPriceRaw !== null && dealerPriceRaw !== null && dealerPriceRaw > userPriceRaw) {
      warnings.push("Dealer price is higher than user price");
    }

    const description = mapping.description ? String(row[mapping.description] ?? "").trim() || undefined : undefined;
    const brand = mapping.brand ? String(row[mapping.brand] ?? "").trim() || undefined : undefined;
    const barcode = mapping.barcode ? String(row[mapping.barcode] ?? "").trim() || undefined : undefined;

    return {
      name,
      category,
      userPrice: userPriceRaw ?? 0,
      dealerPrice: dealerPriceRaw ?? 0,
      quantity: quantityRaw ?? 0,
      description,
      brand,
      barcode,
      storeId: storeId ?? undefined,
      mode,
      _rowIndex: idx + 2, // 1-indexed + header row
      _errors: errors,
      _warnings: warnings,
    };
  });
}

const BATCH_SIZE = 500; // Convex mutation limit safety

export default function ProductImportPage({ selectedStoreId, stores, isManager }: ProductImportPageProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "done">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: "", category: "", userPrice: "", dealerPrice: "",
    quantity: "", description: "", brand: "", barcode: "",
  });
  const [importMode, setImportMode] = useState<ImportMode>("create");
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImport = useMutation(api.products.bulkImport);
  const storesList = useQuery(api.stores.list);

  // ── File parsing ──────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (json.length === 0) {
          toast.error("The file appears to be empty.");
          return;
        }

        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawRows(json);
        setFileName(file.name);
        setMapping(autoDetectMapping(hdrs));
        setStep("map");
        toast.success(`Loaded ${json.length.toLocaleString()} rows from "${file.name}"`);
      } catch {
        toast.error("Could not read file. Please use .xlsx, .xls, or .csv format.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Proceed to preview ────────────────────────────────────────
  const handleProceedToPreview = () => {
    // Check required fields are mapped
    const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missing.length > 0) {
      toast.error(`Please map required fields: ${missing.map((f) => FIELD_LABELS[f].replace(" *", "")).join(", ")}`);
      return;
    }
    const rows = validateAndMap(rawRows, mapping, importMode, selectedStoreId);
    setMappedRows(rows);
    setPreviewPage(0);
    setStep("preview");
  };

  // ── Run import ────────────────────────────────────────────────
  const handleImport = async () => {
    const validRows = mappedRows.filter((r) => r._errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    setStep("importing");
    setImportProgress({ done: 0, total: validRows.length });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
      // Split into batches
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE).map((r) => ({
          name: r.name,
          category: r.category,
          userPrice: r.userPrice,
          dealerPrice: r.dealerPrice,
          quantity: r.quantity,
          description: r.description,
          brand: r.brand,
          barcode: r.barcode,
          storeId: r.storeId,
          mode: r.mode,
        }));

        const result = await bulkImport({ rows: batch });
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        setImportProgress({ done: Math.min(i + BATCH_SIZE, validRows.length), total: validRows.length });
      }

      setImportResult({ created: totalCreated, updated: totalUpdated, skipped: totalSkipped });
      setStep("done");
      toast.success(`Import complete! ${totalCreated} created, ${totalUpdated} updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed. Please try again.");
      setStep("preview");
    }
  };

  // ── Reset ─────────────────────────────────────────────────────
  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMappedRows([]);
    setImportResult(null);
    setImportProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Download template ─────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Product Name": "Example Product",
        "Category": "Electronics",
        "User Price": 299.99,
        "Dealer Price": 199.99,
        "Quantity": 50,
        "Description": "Optional product description",
        "Brand": "BrandName",
        "Barcode": "1234567890123",
      },
      {
        "Product Name": "Another Product",
        "Category": "Accessories",
        "User Price": 49.99,
        "Dealer Price": 29.99,
        "Quantity": 100,
        "Description": "",
        "Brand": "",
        "Barcode": "",
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const { saveAs } = require("file-saver");
    saveAs(new Blob([buf], { type: "application/octet-stream" }), "product-import-template.xlsx");
    toast.success("Template downloaded!");
  };

  // ── Derived stats ─────────────────────────────────────────────
  const errorRows = mappedRows.filter((r) => r._errors.length > 0);
  const warnRows = mappedRows.filter((r) => r._errors.length === 0 && r._warnings.length > 0);
  const validRows = mappedRows.filter((r) => r._errors.length === 0);
  const pagedRows = mappedRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);
  const totalPages = Math.ceil(mappedRows.length / PREVIEW_PAGE_SIZE);

  // ── Step indicator ────────────────────────────────────────────
  const steps = [
    { id: "upload", label: "Upload File" },
    { id: "map", label: "Map Columns" },
    { id: "preview", label: "Preview & Validate" },
    { id: "done", label: "Complete" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Import</h1>
          <p className="text-slate-500 text-sm mt-1">
            Bulk import or update products via Excel / CSV — supports 22,000+ products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
          {step !== "upload" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Step Progress */}
      {step !== "importing" && (
        <div className="mb-8">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => {
              const currentStep = step as string;
      const isActive = s.id === currentStep || (currentStep === "importing" && s.id === "preview");
              const isDone = i < stepIndex || step === "done";
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : "bg-slate-200 text-slate-400"
                      }`}
                    >
                      {isDone ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        isActive ? "text-blue-600" : isDone ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${i < stepIndex ? "bg-emerald-400" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 1: UPLOAD ── */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all ${
                isDragging ? "bg-blue-100" : "bg-slate-100"
              }`}>
                <FileSpreadsheet className={`w-10 h-10 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-700">
                  {isDragging ? "Drop your file here" : "Drag & drop your file here"}
                </p>
                <p className="text-slate-400 text-sm mt-1">or click to browse</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="px-2 py-1 bg-slate-100 rounded-md font-mono">.xlsx</span>
                <span className="px-2 py-1 bg-slate-100 rounded-md font-mono">.xls</span>
                <span className="px-2 py-1 bg-slate-100 rounded-md font-mono">.csv</span>
              </div>
              <p className="text-xs text-slate-400">Supports up to 22,000+ products per file</p>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Table2,
                color: "text-blue-500",
                bg: "bg-blue-50",
                title: "Required Columns",
                desc: "Name, Category, User Price, Dealer Price, Quantity",
              },
              {
                icon: Zap,
                color: "text-amber-500",
                bg: "bg-amber-50",
                title: "Smart Detection",
                desc: "Column headers are auto-detected — Arabic & English supported",
              },
              {
                icon: RefreshCw,
                color: "text-emerald-500",
                bg: "bg-emerald-50",
                title: "3 Import Modes",
                desc: "Create new, update quantities only, or update all fields",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
                  <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{card.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{card.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2: MAP COLUMNS ── */}
      {step === "map" && (
        <div className="space-y-6">
          {/* File info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">{fileName}</p>
              <p className="text-xs text-slate-400">{rawRows.length.toLocaleString()} rows · {headers.length} columns detected</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              File loaded
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column mapping */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Table2 className="w-5 h-5 text-blue-500" />
                <h2 className="font-semibold text-slate-800">Map Your Columns</h2>
                <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                  * = required
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => {
                  const isRequired = REQUIRED_FIELDS.includes(field);
                  const isMapped = !!mapping[field];
                  return (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">
                        {FIELD_LABELS[field]}
                        {isMapped && (
                          <span className="ml-2 text-emerald-500 font-normal">✓ mapped</span>
                        )}
                      </label>
                      <div className="relative">
                        <select
                          value={mapping[field]}
                          onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                          className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white transition-colors ${
                            isRequired && !isMapped
                              ? "border-amber-300 bg-amber-50/30"
                              : isMapped
                              ? "border-emerald-300 bg-emerald-50/20"
                              : "border-slate-200"
                          }`}
                        >
                          <option value="">— Not mapped —</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Import mode + store */}
            <div className="space-y-4">
              {/* Import mode */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-4 text-sm">Import Mode</h2>
                <div className="space-y-2">
                  {[
                    {
                      value: "create" as ImportMode,
                      label: "Create New",
                      desc: "Add new products only. Skip if product already exists.",
                      color: "border-blue-400 bg-blue-50",
                      dot: "bg-blue-500",
                    },
                    {
                      value: "update_qty" as ImportMode,
                      label: "Update Quantities",
                      desc: "Only update stock quantities for existing products.",
                      color: "border-amber-400 bg-amber-50",
                      dot: "bg-amber-500",
                    },
                    {
                      value: "update_all" as ImportMode,
                      label: "Update All Fields",
                      desc: "Update all fields for existing products. Create if not found.",
                      color: "border-emerald-400 bg-emerald-50",
                      dot: "bg-emerald-500",
                    },
                  ].map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setImportMode(m.value)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        importMode === m.value ? m.color : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${importMode === m.value ? m.dot : "bg-slate-300"}`} />
                        <span className="text-sm font-semibold text-slate-800">{m.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 pl-4">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Store assignment */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-semibold text-slate-800 mb-3 text-sm">Store Assignment</h2>
                {selectedStoreId ? (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-700">
                        {stores.find((s) => s._id === selectedStoreId)?.name}
                      </p>
                      <p className="text-xs text-blue-500">Products will be assigned to this store</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      No store selected. Products will be created without a store assignment. Select a store from the sidebar to assign them.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleProceedToPreview}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2"
              >
                Validate & Preview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & VALIDATE ── */}
      {step === "preview" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Rows", value: mappedRows.length, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
              { label: "Valid", value: validRows.length, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Warnings", value: warnRows.length, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
              { label: "Errors", value: errorRows.length, color: "text-red-700", bg: "bg-red-50 border-red-200" },
            ].map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
                <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Error summary */}
          {errorRows.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-semibold text-red-700">
                    {errorRows.length} rows have errors and will be skipped
                  </p>
                </div>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  {showErrors ? "Hide" : "Show"} details
                </button>
              </div>
              {showErrors && (
                <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {errorRows.slice(0, 20).map((r) => (
                    <div key={r._rowIndex} className="text-xs text-red-600 bg-red-100/50 rounded-lg px-3 py-1.5">
                      <span className="font-semibold">Row {r._rowIndex}:</span>{" "}
                      {r._errors.join(" · ")}
                    </div>
                  ))}
                  {errorRows.length > 20 && (
                    <p className="text-xs text-red-400 px-3">…and {errorRows.length - 20} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Data Preview</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing rows {previewPage * PREVIEW_PAGE_SIZE + 1}–{Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, mappedRows.length)} of {mappedRows.length.toLocaleString()}
                </p>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                    disabled={previewPage === 0}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500">
                    {previewPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={previewPage === totalPages - 1}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Row</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">User Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Dealer Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.map((row) => {
                    const hasError = row._errors.length > 0;
                    const hasWarn = !hasError && row._warnings.length > 0;
                    return (
                      <tr
                        key={row._rowIndex}
                        className={`transition-colors ${
                          hasError ? "bg-red-50/50 hover:bg-red-50" : hasWarn ? "bg-amber-50/30 hover:bg-amber-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{row._rowIndex}</td>
                        <td className="px-4 py-3">
                          {hasError ? (
                            <span title={row._errors.join("; ")}>
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            </span>
                          ) : hasWarn ? (
                            <span title={row._warnings.join("; ")}>
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            </span>
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{row.category || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs">
                          {row._errors.some((e) => e.includes("User price")) ? (
                            <span className="text-red-400">—</span>
                          ) : (
                            `ج.م ${row.userPrice.toFixed(2)}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs">
                          {row._errors.some((e) => e.includes("Dealer price")) ? (
                            <span className="text-red-400">—</span>
                          ) : (
                            `ج.م ${row.dealerPrice.toFixed(2)}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs">{row.quantity}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">{row.barcode ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600">
              Ready to import{" "}
              <span className="font-bold text-emerald-600">{validRows.length.toLocaleString()}</span> valid rows
              {errorRows.length > 0 && (
                <span className="text-slate-400">
                  {" "}({errorRows.length} rows with errors will be skipped)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("map")}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:from-emerald-700 hover:to-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Import {validRows.length.toLocaleString()} Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORTING ── */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center py-24 gap-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Importing Products…</h2>
            <p className="text-slate-500 text-sm">
              Processing {importProgress.done.toLocaleString()} of {importProgress.total.toLocaleString()} products
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-full max-w-md">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>{importProgress.done.toLocaleString()} done</span>
              <span>{importProgress.total > 0 ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                style={{
                  width: importProgress.total > 0
                    ? `${(importProgress.done / importProgress.total) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">Please don't close this page</p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && importResult && (
        <div className="flex flex-col items-center justify-center py-16 gap-8">
          <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle className="w-14 h-14 text-emerald-500" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Import Complete!</h2>
            <p className="text-slate-500">Your products have been successfully imported.</p>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
            {[
              { label: "Created", value: importResult.created, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              { label: "Updated", value: importResult.updated, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
              { label: "Skipped", value: importResult.skipped, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl border p-6 text-center ${card.bg}`}>
                <p className={`text-3xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
                <p className="text-sm text-slate-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" />
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
