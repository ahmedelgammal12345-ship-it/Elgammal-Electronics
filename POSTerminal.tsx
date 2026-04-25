// POS Terminal — v3 (deposit/partial payment)
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Search, Plus, Minus, ShoppingCart, CreditCard, Banknote,
  Tag, User, Phone, X, Check, SlidersHorizontal, Package,
  Scan, UserCheck, BadgeCheck, ChevronUp, ChevronDown,
  Smartphone, FileText, Hash, Building2, Calendar,
  Clock, AlertCircle,
} from "lucide-react";
import SaleReceiptModal from "./SaleReceiptModal";
import CategoryDropdown from "./CategoryDropdown";

interface CartItem {
  productId: Id<"products">;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  total: number;
}

interface POSProps {
  selectedStoreId: Id<"stores"> | null;
  stores: Array<{ _id: Id<"stores">; name: string }>;
}

export default function POSTerminal({ selectedStoreId, stores }: POSProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [specialDiscount, setSpecialDiscount] = useState(0); // fixed EGP amount off
  const [taxRate, setTaxRate] = useState(0); // 0 = no tax, 14 = 14% VAT
  const [paymentType, setPaymentType] = useState<"cash" | "credit" | "phone_transfer" | "cheque">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [notes, setNotes] = useState("");
  // Cheque-specific fields
  const [chequeNumber, setChequeNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeHolderName, setChequeHolderName] = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  // Deposit / partial payment
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [customerId, setCustomerId] = useState<Id<"customers"> | null>(null);

  // Save new customer from POS
  const [saveAsCustomer, setSaveAsCustomer] = useState(false);
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [priceType, setPriceType] = useState<"user" | "dealer">("user");
  const [activeStoreId, setActiveStoreId] = useState<Id<"stores"> | null>(selectedStoreId);

  // ── Receipt modal state ────────────────────────────────────────────────────
  const [completedSaleId, setCompletedSaleId] = useState<Id<"sales"> | null>(null);

  // ── Customer phone lookup state ────────────────────────────────────────────
  const [phoneSearchInput, setPhoneSearchInput] = useState("");
  const [loyaltyApplied, setLoyaltyApplied] = useState(false);

  // ── Barcode scanner state ──────────────────────────────────────────────────
  // Keyboard-wedge scanners fire characters rapidly then send Enter.
  // We buffer chars; if Enter arrives within 100ms of the first char, treat as scan.
  const barcodeBuffer = useRef<string>("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastScanned, setLastScanned] = useState<string>("");
  const [scannerActive, setScannerActive] = useState(true);

  // Query fires only when lastScanned is non-empty
  const scannedProduct = useQuery(
    api.products.getByBarcode,
    lastScanned ? { barcode: lastScanned } : "skip"
  );

  // When scannedProduct resolves, add to cart
  useEffect(() => {
    if (!lastScanned) return;
    if (scannedProduct === undefined) return; // still loading
    if (scannedProduct === null) {
      toast.error(`No product found for barcode: ${lastScanned}`, { id: "barcode-miss" });
    } else {
      addToCart(scannedProduct);
      toast.success(`Added: ${scannedProduct.name}`, { id: "barcode-hit", duration: 1500 });
    }
    setLastScanned("");
  }, [scannedProduct, lastScanned]);

  // Global keydown listener for barcode wedge input
  useEffect(() => {
    if (!scannerActive) return;
    const handleKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Enter") {
        const code = barcodeBuffer.current.trim();
        barcodeBuffer.current = "";
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        if (code.length >= 3) {
          setLastScanned(code);
        }
        return;
      }

      // Printable character — accumulate
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        // Auto-flush after 150ms of silence (handles scanners that don't send Enter)
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
          const code = barcodeBuffer.current.trim();
          barcodeBuffer.current = "";
          if (code.length >= 3) {
            setLastScanned(code);
          }
        }, 150);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [scannerActive]);
  // ──────────────────────────────────────────────────────────────────────────

  const hasFilter = searchQuery.trim() !== "" || selectedCategory !== "";
  // When no filter active, load default products for immediate browsing (same pattern as Quotations)
  const defaultProducts = useQuery(
    api.products.list,
    !hasFilter ? { limit: 60 } : "skip"
  );
  const filteredProducts = useQuery(
    api.products.search,
    hasFilter ? { query: searchQuery, category: selectedCategory || undefined } : "skip"
  );
  const products = hasFilter ? filteredProducts : defaultProducts;
  const categories = useQuery(api.products.getCategories);
  const createSale = useMutation(api.sales.create);
  const createCustomer = useMutation(api.customers.create);

  // Salesmen list for dropdown — filtered by active store if set
  const salesmenList = useQuery(api.salesmen.list, {
    storeId: activeStoreId ?? undefined,
    activeOnly: true,
  });

  // Customer phone lookup — fires when ≥7 digits entered
  const foundCustomer = useQuery(
    api.customers.searchByPhone,
    phoneSearchInput.replace(/\D/g, "").length >= 7
      ? { phone: phoneSearchInput.trim() }
      : "skip"
  );

  // Completed sale query — fires after checkout to show receipt modal
  const completedSale = useQuery(
    api.sales.get,
    completedSaleId ? { saleId: completedSaleId } : "skip"
  );

  // Store data for receipt modal
  const activeStore = useQuery(
    api.stores.get,
    activeStoreId ? { storeId: activeStoreId } : "skip"
  );

  // Auto-fill customer name + apply loyalty discount when customer found by phone
  useEffect(() => {
    if (foundCustomer === undefined) return;
    if (foundCustomer === null) {
      if (loyaltyApplied) { setDiscount(0); setLoyaltyApplied(false); }
      setCustomerId(null);
      return;
    }
    setCustomerId(foundCustomer._id);
    if (foundCustomer.name) setCustomerName(foundCustomer.name);
    if (foundCustomer.loyaltyDiscount && foundCustomer.loyaltyDiscount > 0) {
      setDiscount(foundCustomer.loyaltyDiscount);
      setLoyaltyApplied(true);
      toast.success(`Customer found! Loyalty discount ${foundCustomer.loyaltyDiscount}% applied.`, { id: "loyalty-applied", duration: 3000 });
    } else {
      setLoyaltyApplied(false);
      toast.success(`Customer found: ${foundCustomer.name}`, { id: "customer-found", duration: 2000 });
    }
  }, [foundCustomer]);

  const addToCart = useCallback((product: any) => {
    const price = priceType === "user" ? product.userPrice : product.dealerPrice;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product._id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [...prev, {
        productId: product._id,
        productName: product.name,
        quantity: 1,
        unitPrice: price,
        originalPrice: price,
        total: price,
      }];
    });
  }, [priceType]);

  const updateQty = (productId: Id<"products">, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.unitPrice } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const updatePrice = (productId: Id<"products">, newPrice: number) => {
    setCart((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, unitPrice: newPrice, total: i.quantity * newPrice } : i)
    );
  };

  const removeFromCart = (productId: Id<"products">) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const specialDiscountCapped = Math.min(specialDiscount, subtotal);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = Math.max(0, subtotal - discountAmount - specialDiscountCapped + taxAmount);

  // Deposit helpers
  const depositCapped = Math.min(Math.max(0, depositAmount), total);
  const remainingAfterDeposit = total - depositCapped;

  const resetForm = () => {
    setCart([]);
    setDiscount(0);
    setSpecialDiscount(0);
    setTaxRate(0);
    setLoyaltyApplied(false);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerId(null);
    setSalesmanName("");
    setPhoneSearchInput("");
    setNotes("");
    setChequeNumber("");
    setBankName("");
    setChequeHolderName("");
    setChequeDueDate("");
    setIsPartialPayment(false);
    setDepositAmount(0);
    setSaveAsCustomer(false);
    setNewCustomerEmail("");
  };

  const handleCheckout = async () => {
    if (!activeStoreId) { toast.error("Please select a store first"); return; }
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (paymentType === "cheque") {
      if (!chequeNumber.trim()) { toast.error("Please enter the cheque number"); return; }
      if (!bankName.trim()) { toast.error("Please enter the bank name"); return; }
      if (!chequeHolderName.trim()) { toast.error("Please enter the cheque holder name"); return; }
      if (!chequeDueDate) { toast.error("Please select the cheque due date"); return; }
    }
    if (isPartialPayment) {
      if (!customerId && !customerName.trim()) { toast.error("A customer name or phone is required for deposit sales"); return; }
      if (depositCapped <= 0) { toast.error("Deposit amount must be greater than zero"); return; }
      if (depositCapped >= total) { toast.error("Deposit equals full amount — use regular checkout instead"); return; }
    }
    try {
      // Auto-create customer if checkbox is checked and no existing customer found
      let resolvedCustomerId = customerId;
      if (saveAsCustomer && !customerId && customerName.trim()) {
        setSavingCustomer(true);
        try {
          resolvedCustomerId = await createCustomer({
            name: customerName.trim(),
            phone: customerPhone.trim() || undefined,
            email: newCustomerEmail.trim() || undefined,
            storeId: activeStoreId ?? undefined,
          });
          toast.success(`Customer "${customerName.trim()}" saved to Customers page! 🎉`, { duration: 3000 });
        } catch (custErr) {
          // If duplicate phone, just warn but continue with the sale
          const msg = custErr instanceof Error ? custErr.message : "";
          if (msg.includes("already exists")) {
            toast.warning("Customer with this phone already exists — sale linked without creating duplicate.", { duration: 4000 });
          } else {
            toast.error(`Could not save customer: ${msg}`);
          }
        } finally {
          setSavingCustomer(false);
        }
      }

      const newSaleId = await createSale({
        storeId: activeStoreId,
        customerId: resolvedCustomerId ?? undefined,
        items: cart.map(({ productId, productName, quantity, unitPrice, total }) => ({ productId, productName, quantity, unitPrice, total })),
        subtotal,
        discount: discount > 0 ? discount : undefined,
        specialDiscount: specialDiscountCapped > 0 ? specialDiscountCapped : undefined,
        taxRate: taxRate > 0 ? taxRate : undefined,
        taxAmount: taxRate > 0 ? taxAmount : undefined,
        total,
        paymentType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        salesmanName: salesmanName || undefined,
        notes: notes || undefined,
        chequeNumber: paymentType === "cheque" ? chequeNumber.trim() : undefined,
        bankName: paymentType === "cheque" ? bankName.trim() : undefined,
        chequeHolderName: paymentType === "cheque" ? chequeHolderName.trim() : undefined,
        chequeDueDate: paymentType === "cheque" ? chequeDueDate : undefined,
        deposit: isPartialPayment ? depositCapped : undefined,
        isPartialPayment: isPartialPayment || undefined,
      });
      toast.success(isPartialPayment
        ? `Deposit sale created! Balance due: ج.م${remainingAfterDeposit.toFixed(2)}`
        : "Sale completed! Opening receipt…"
      );
      setCompletedSaleId(newSaleId);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete sale");
    }
  };

  // Close receipt modal and reset completedSaleId
  const handleReceiptClose = () => {
    setCompletedSaleId(null);
  };

  // Shared cart panel content (used in both desktop sidebar and mobile drawer)
  // ⚠️ Must be a JSX variable (not a component) to prevent focus loss on re-render
  const cartContent = (
    <>
      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Add products to cart</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-slate-800 flex-1 leading-tight">{item.productName}</p>
                <button onClick={() => removeFromCart(item.productId)} className="ml-2 text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Price edit */}
              <div className="flex items-center gap-2 mb-2">
                <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updatePrice(item.productId, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-400 outline-none"
                  step="0.01"
                />
                <span className="text-xs text-slate-400">/ unit</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.productId, -1)} className="w-7 h-7 rounded-md bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.productId, 1)} className="w-7 h-7 rounded-md bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3 text-blue-600" />
                  </button>
                </div>
                <span className="text-sm font-bold text-slate-900">ج.م{item.total.toFixed(2)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals & Checkout */}
      {cart.length > 0 && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          {/* Discount row */}
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-600 flex-1">Discount %</span>
            {/* Quick 1% discount button */}
            <button
              onClick={() => setDiscount((d) => d === 1 ? 0 : 1)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0 ${
                discount === 1
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              1%
            </button>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-14 px-2 py-1 text-sm border border-slate-200 rounded focus:border-blue-400 outline-none text-right"
              min="0" max="100"
            />
          </div>

          {/* Special Discount row — fixed EGP amount */}
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-sm flex-shrink-0">★</span>
            <span className="text-sm text-slate-600 flex-1">Special Discount</span>
            <span className="text-xs text-slate-400 flex-shrink-0">ج.م</span>
            <input
              type="number"
              value={specialDiscount || ""}
              onChange={(e) => setSpecialDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              className="w-20 px-2 py-1 text-sm border border-purple-200 rounded focus:border-purple-400 outline-none text-right bg-purple-50 placeholder-slate-300"
              min="0"
              step="0.01"
            />
          </div>

          {/* Tax row */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm flex-shrink-0">%</span>
            <span className="text-sm text-slate-600 flex-1">Tax (VAT)</span>
            {/* Quick 14% tax button */}
            <button
              onClick={() => setTaxRate((t) => t === 14 ? 0 : 14)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0 ${
                taxRate === 14
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
              }`}
            >
              14%
            </button>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              className="w-14 px-2 py-1 text-sm border border-slate-200 rounded focus:border-blue-400 outline-none text-right"
              min="0" max="100"
            />
          </div>

          {/* Totals breakdown */}
          <div className="space-y-1 text-sm bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>ج.م{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount ({discount}%)</span>
                <span>-ج.م{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {specialDiscountCapped > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Special Discount</span>
                <span>-ج.م{specialDiscountCapped.toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Tax ({taxRate}%)</span>
                <span>+ج.م{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 text-base pt-1.5 border-t border-slate-200 mt-1">
              <span>Total</span><span>ج.م{total.toFixed(2)}</span>
            </div>
          </div>

          {/* ── Deposit / Partial Payment Toggle ── */}
          <div className={`rounded-xl border p-3 transition-all ${isPartialPayment ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"}`}>
            <button
              onClick={() => { setIsPartialPayment((v) => !v); setDepositAmount(0); }}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isPartialPayment ? "text-amber-600" : "text-slate-400"}`} />
                <span className={`text-sm font-semibold ${isPartialPayment ? "text-amber-800" : "text-slate-600"}`}>
                  Deposit / Partial Payment
                </span>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${isPartialPayment ? "bg-amber-500" : "bg-slate-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPartialPayment ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </button>
            {isPartialPayment && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Sale stays <strong>pending</strong> until fully paid. Customer required.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 flex-shrink-0">Deposit (ج.م)</span>
                  <input
                    type="number"
                    value={depositAmount || ""}
                    onChange={(e) => setDepositAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="flex-1 px-2 py-1.5 text-sm border border-amber-300 rounded-lg focus:border-amber-500 outline-none text-right bg-white font-semibold"
                    min="0"
                    max={total}
                    step="0.01"
                  />
                </div>
                {depositCapped > 0 && (
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t border-amber-200">
                    <span className="text-emerald-700">Paid now: ج.م{depositCapped.toFixed(2)}</span>
                    <span className="text-red-600">Remaining: ج.م{remainingAfterDeposit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Type — 4 options */}
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { key: "cash",           label: "Cash",     Icon: Banknote,    active: "bg-emerald-600 text-white" },
              { key: "credit",         label: "Credit",   Icon: CreditCard,  active: "bg-amber-500 text-white" },
              { key: "phone_transfer", label: "Transfer", Icon: Smartphone,  active: "bg-blue-600 text-white" },
              { key: "cheque",         label: "Cheque",   Icon: FileText,    active: "bg-purple-600 text-white" },
            ] as const).map(({ key, label, Icon, active }) => (
              <button
                key={key}
                onClick={() => setPaymentType(key)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${paymentType === key ? active : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          {/* Cheque Details — shown only when cheque is selected */}
          {paymentType === "cheque" && (
            <div className="space-y-2 p-3 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Cheque Details
              </p>
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                <input
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="Cheque number *"
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-purple-200 rounded-lg focus:border-purple-400 outline-none bg-white"
                />
              </div>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank name *"
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-purple-200 rounded-lg focus:border-purple-400 outline-none bg-white"
                />
              </div>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                <input
                  value={chequeHolderName}
                  onChange={(e) => setChequeHolderName(e.target.value)}
                  placeholder="Cheque holder name *"
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-purple-200 rounded-lg focus:border-purple-400 outline-none bg-white"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                <input
                  type="date"
                  value={chequeDueDate}
                  onChange={(e) => setChequeDueDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-purple-200 rounded-lg focus:border-purple-400 outline-none bg-white"
                />
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-2">
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  // If user types a name and no customer found yet, suggest saving
                  if (e.target.value.trim() && !customerId) setSaveAsCustomer(true);
                  if (!e.target.value.trim()) setSaveAsCustomer(false);
                }}
                placeholder={isPartialPayment ? "Customer name *" : "Customer name (optional)"}
                className={`w-full pl-8 pr-3 py-2.5 text-sm border rounded-lg focus:border-blue-400 outline-none ${isPartialPayment ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}
              />
            </div>
            <div className="relative">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={customerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); setPhoneSearchInput(e.target.value); }}
                placeholder="Phone number (optional)"
                className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
              />
              {foundCustomer && (
                <UserCheck className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
              )}
            </div>

            {/* ── Save as New Customer ── */}
            {customerName.trim() && !customerId && (
              <div className={`rounded-xl border transition-all overflow-hidden ${saveAsCustomer ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                {/* Checkbox row */}
                <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none">
                  <div
                    onClick={() => setSaveAsCustomer((v) => !v)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${saveAsCustomer ? "bg-emerald-600 border-emerald-600" : "border-slate-300 bg-white"}`}
                  >
                    {saveAsCustomer && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${saveAsCustomer ? "text-emerald-800" : "text-slate-600"}`}>
                      Save as new customer
                    </p>
                    {!saveAsCustomer && (
                      <p className="text-xs text-slate-400">Add to Customers page automatically</p>
                    )}
                  </div>
                  {saveAsCustomer && (
                    <span className="text-xs px-1.5 py-0.5 bg-emerald-600 text-white rounded-full font-bold flex-shrink-0">ON</span>
                  )}
                </label>

                {/* Extra fields when checked */}
                {saveAsCustomer && (
                  <div className="px-3 pb-3 space-y-2 border-t border-emerald-200">
                    <p className="text-xs text-emerald-700 pt-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      Will be saved: <strong>{customerName.trim()}</strong>
                      {customerPhone.trim() && <> · {customerPhone.trim()}</>}
                    </p>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">@</span>
                      <input
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                        placeholder="Email (optional)"
                        type="email"
                        className="w-full pl-7 pr-3 py-2 text-xs border border-emerald-200 rounded-lg focus:border-emerald-400 outline-none bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing customer badge */}
            {customerId && foundCustomer && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200">
                <UserCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 truncate">{foundCustomer.name}</p>
                  <p className="text-xs text-blue-500">Existing customer · {foundCustomer.loyaltyPoints} pts</p>
                </div>
                {foundCustomer.loyaltyDiscount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full font-bold flex-shrink-0">{foundCustomer.loyaltyDiscount}% off</span>
                )}
              </div>
            )}

            <div className="relative">
              <BadgeCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
              <select
                value={salesmanName}
                onChange={(e) => setSalesmanName(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-400 outline-none bg-white"
              >
                <option value="">— Salesman (optional) —</option>
                {(salesmenList ?? []).map((s) => (
                  <option key={s._id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={savingCustomer}
            className={`w-full py-3.5 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${
              isPartialPayment
                ? "bg-amber-500 hover:bg-amber-600 text-white hover:shadow-amber-500/25"
                : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/25"
            }`}
          >
            {savingCustomer ? (
              <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving customer…</>
            ) : isPartialPayment ? (
              <><Clock className="w-5 h-5" />{`Deposit Sale · ج.م${depositCapped > 0 ? depositCapped.toFixed(2) : "0.00"} now`}</>
            ) : (
              <><Check className="w-5 h-5" />{`Complete Sale · ج.م${total.toFixed(2)}`}</>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full relative">

      {/* Receipt Modal */}
      {completedSaleId && completedSale && (
        <SaleReceiptModal
          sale={completedSale}
          store={activeStore ?? null}
          onClose={handleReceiptClose}
        />
      )}

      {/* ── Products Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200 p-3 space-y-2.5">
          {/* Row 1: Search + controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
              />
            </div>
            {/* Store selector — hidden on mobile (controlled from top bar) */}
            <select
              value={activeStoreId ?? ""}
              onChange={(e) => setActiveStoreId(e.target.value as Id<"stores"> || null)}
              className="hidden md:block px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none bg-white max-w-36"
            >
              <option value="">Select Store</option>
              {stores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {/* Price type toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
              <button
                onClick={() => setPriceType("user")}
                className={`px-2.5 py-2 text-xs font-medium transition-colors ${priceType === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                User
              </button>
              <button
                onClick={() => setPriceType("dealer")}
                className={`px-2.5 py-2 text-xs font-medium transition-colors ${priceType === "dealer" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Dealer
              </button>
            </div>
            {/* Barcode scanner toggle */}
            <button
              onClick={() => setScannerActive((v) => !v)}
              title={scannerActive ? "Scanner ON" : "Scanner OFF"}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all flex-shrink-0 ${
                scannerActive
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              {scannerActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:block" />}
            </button>
          </div>

          {/* Category Filter */}
          <CategoryDropdown
            categories={categories ?? []}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            compact
          />
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-auto p-3 pb-24 md:pb-4">
          {products === undefined ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded mb-2 w-3/4" />
                  <div className="h-3 bg-slate-100 rounded mb-3 w-1/2" />
                  <div className="h-6 bg-slate-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {(products ?? []).map((product, idx) => {
                const price = priceType === "user" ? product.userPrice : product.dealerPrice;
                const inCart = cart.find((i) => i.productId === product._id);
                return (
                  <button
                    key={product._id}
                    onClick={() => addToCart(product)}
                    className={`text-left bg-white rounded-xl p-3 border transition-all duration-200 active:scale-95 ${
                      inCart ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-100 hover:border-blue-200 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full truncate max-w-20">{product.category}</span>
                      {inCart && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded-full font-bold flex-shrink-0">{inCart.quantity}</span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">{product.name}</p>
                    {product.brand && <p className="text-xs text-slate-400 mb-1.5 truncate">{product.brand}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-600">ج.م{price.toFixed(2)}</span>
                      <span className={`text-xs ${product.quantity <= 5 ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        {product.quantity}
                      </span>
                    </div>
                  </button>
                );
              })}
              {products.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No products found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP Cart Panel (right sidebar) ── */}
      <div className="hidden md:flex w-80 bg-white border-l border-slate-200 flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-700" />
            <h2 className="font-semibold text-slate-900">Cart</h2>
            {cart.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full font-bold">{cart.length}</span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 transition-colors">
              Clear all
            </button>
          )}
        </div>
        {cartContent}
      </div>

      {/* ── MOBILE Cart FAB + Drawer ── */}
      <div className="md:hidden">
        {/* Floating cart button */}
        {cart.length > 0 && !mobileCartOpen && (
          <button
            onClick={() => setMobileCartOpen(true)}
            className="fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 font-semibold text-sm active:scale-95 transition-transform"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            <span className="font-bold">· ج.م{total.toFixed(2)}</span>
            <ChevronUp className="w-4 h-4 ml-1" />
          </button>
        )}

        {/* Mobile Cart Drawer */}
        {mobileCartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileCartOpen(false)}
            />
            {/* Drawer */}
            <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
              {/* Handle + Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-slate-700" />
                  <h2 className="font-bold text-slate-900 text-lg">Cart</h2>
                  <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full font-bold">{cart.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-xs text-red-500 font-medium">
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={() => setMobileCartOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {cartContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
