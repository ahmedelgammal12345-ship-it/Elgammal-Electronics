import { useRef } from "react";
import { X, Printer, Download } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import jsPDF from "jspdf";

interface SaleItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SaleReceiptProps {
  sale: {
    _id: Id<"sales">;
    _creationTime: number;
    storeId: Id<"stores">;
    items: SaleItem[];
    subtotal: number;
    discount?: number;
    specialDiscount?: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
    paymentType: "cash" | "credit" | "phone_transfer" | "cheque";
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    status: string;
    saleNumber?: string;
    seqNumber?: number;
    salesmanName?: string;
    // Cheque fields
    chequeNumber?: string;
    bankName?: string;
    chequeHolderName?: string;
    chequeDueDate?: string;
  };
  store?: {
    name: string;
    address?: string;
    phone?: string;
  } | null;
  onClose: () => void;
}

export default function SaleReceiptModal({ sale, store, onClose }: SaleReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = new jsPDF({ unit: "mm", format: [80, 200] }) as any;
    const pageW = 80;
    let y = 10;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(store?.name ?? "POS System", pageW / 2, y, { align: "center" });
    y += 6;
    if (store?.address) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(store.address, pageW / 2, y, { align: "center" });
      y += 4;
    }
    if (store?.phone) {
      doc.setFontSize(8);
      doc.text(`Tel: ${store.phone}`, pageW / 2, y, { align: "center" });
      y += 4;
    }
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDash([1, 1]);
    doc.line(5, y, pageW - 5, y);
    y += 4;

    // Meta — use saleNumber if available, fallback to legacy RCP format
    const displayNumber = sale.saleNumber ?? `RCP-${sale._id.slice(-8).toUpperCase()}`;
    const date = new Date(sale._creationTime);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Sale No: ${displayNumber}`, 5, y);
    y += 4;
    doc.text(`Date: ${date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`, 5, y);
    y += 4;
    doc.text(`Time: ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`, 5, y);
    y += 4;
    const paymentLabels: Record<string, string> = { cash: "CASH", credit: "CREDIT CARD", phone_transfer: "PHONE TRANSFER", cheque: "CHEQUE" };
    doc.text(`Payment: ${paymentLabels[sale.paymentType] ?? sale.paymentType.toUpperCase()}`, 5, y);
    y += 4;
    if (sale.customerName) { doc.text(`Customer: ${sale.customerName}`, 5, y); y += 4; }
    // Cheque details in PDF
    if (sale.paymentType === "cheque") {
      if (sale.chequeNumber) { doc.text(`Cheque No: ${sale.chequeNumber}`, 5, y); y += 4; }
      if (sale.bankName) { doc.text(`Bank: ${sale.bankName}`, 5, y); y += 4; }
      if (sale.chequeHolderName) { doc.text(`Holder: ${sale.chequeHolderName}`, 5, y); y += 4; }
      if (sale.chequeDueDate) {
        const dueFormatted = new Date(sale.chequeDueDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        doc.text(`Due Date: ${dueFormatted}`, 5, y); y += 4;
      }
    }
    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(5, y, pageW - 5, y);
    y += 4;

    // Items
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Item", 5, y);
    doc.text("Qty", 48, y, { align: "right" });
    doc.text("Price", 62, y, { align: "right" });
    doc.text("Total", pageW - 5, y, { align: "right" });
    y += 3;
    doc.setLineDash([]);
    doc.line(5, y, pageW - 5, y);
    y += 3;

    doc.setFont("helvetica", "normal");
    for (const item of sale.items) {
      const name = item.productName.length > 22 ? item.productName.substring(0, 22) + "…" : item.productName;
      doc.text(name, 5, y);
      doc.text(String(item.quantity), 48, y, { align: "right" });
      doc.text(`EGP ${item.unitPrice.toFixed(2)}`, 62, y, { align: "right" });
      doc.text(`EGP ${item.total.toFixed(2)}`, pageW - 5, y, { align: "right" });
      y += 5;
    }

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(5, y, pageW - 5, y);
    y += 4;

    // Totals
    doc.setFontSize(8);
    doc.text("Subtotal:", 5, y);
    doc.text(`EGP ${sale.subtotal.toFixed(2)}`, pageW - 5, y, { align: "right" });
    y += 5;
    // Both calculated from original subtotal independently
    const discountAmount = sale.discount ? (sale.subtotal * sale.discount) / 100 : 0;
    const pdfTaxAmt = sale.taxRate ? (sale.subtotal * sale.taxRate) / 100 : (sale.taxAmount ?? 0);
    if (sale.discount && sale.discount > 0) {
      doc.text(`Discount (${sale.discount}%):`, 5, y);
      doc.text(`-EGP ${discountAmount.toFixed(2)}`, pageW - 5, y, { align: "right" });
      y += 5;
    }
    if (sale.specialDiscount && sale.specialDiscount > 0) {
      doc.text(`Special Discount:`, 5, y);
      doc.text(`-EGP ${sale.specialDiscount.toFixed(2)}`, pageW - 5, y, { align: "right" });
      y += 5;
    }
    if (sale.taxRate && sale.taxRate > 0) {
      doc.text(`Tax VAT (${sale.taxRate}%):`, 5, y);
      doc.text(`+EGP ${pdfTaxAmt.toFixed(2)}`, pageW - 5, y, { align: "right" });
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL:", 5, y);
    doc.text(`EGP ${sale.total.toFixed(2)}`, pageW - 5, y, { align: "right" });
    y += 6;

    doc.setLineDash([1, 1]);
    doc.line(5, y, pageW - 5, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Thank you for your purchase!", pageW / 2, y, { align: "center" });

    doc.save(`${displayNumber}.pdf`);
  };

  // Use the proper sale number (e.g. "MAD-00001") if available, fallback to legacy format
  const displayNumber = sale.saleNumber ?? `RCP-${sale._id.slice(-8).toUpperCase()}`;
  const date = new Date(sale._creationTime);
  // Both discount and tax are calculated from the original subtotal independently
  const discountAmount = sale.discount ? (sale.subtotal * sale.discount) / 100 : 0;
  const taxAmt = sale.taxRate ? (sale.subtotal * sale.taxRate) / 100 : (sale.taxAmount ?? 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in print:hidden-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up print:shadow-none print:rounded-none print:max-w-none print:w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Printer className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Sale Receipt</h2>
              <p className="text-xs text-slate-400 font-mono">{displayNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div
          ref={receiptRef}
          id="print-receipt"
          className="p-6 overflow-auto max-h-[75vh] print:max-h-none print:overflow-visible print:p-8"
        >
          {/* Store Header */}
          <div className="text-center mb-6 pb-5 border-b-2 border-dashed border-slate-200">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 print:bg-black">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {store?.name ?? "POS System"}
            </h1>
            {store?.address && (
              <p className="text-sm text-slate-500 mt-0.5">{store.address}</p>
            )}
            {store?.phone && (
              <p className="text-sm text-slate-500">Tel: {store.phone}</p>
            )}
          </div>

          {/* Receipt Meta */}
          <div className="mb-5">
            {[
              { label: "Receipt No.", value: displayNumber, mono: true },
              { label: "Date", value: date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
              { label: "Time", value: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{row.label}</span>
                <span className={`text-sm font-bold text-slate-800 ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment</span>
              <span className={`text-sm font-semibold ${
                sale.paymentType === "cash" ? "text-emerald-600" :
                sale.paymentType === "credit" ? "text-amber-600" :
                sale.paymentType === "phone_transfer" ? "text-blue-600" :
                "text-purple-600"
              }`}>
                {{ cash: "Cash", credit: "Credit Card", phone_transfer: "Phone Transfer", cheque: "Cheque" }[sale.paymentType] ?? sale.paymentType}
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                sale.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                sale.status === "pending" ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                {sale.status}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          {(sale.customerName || sale.customerPhone) && (
            <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100 print:border-slate-300 print:bg-white">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Customer</p>
              {sale.customerName && <p className="text-sm font-semibold text-slate-800">{sale.customerName}</p>}
              {sale.customerPhone && <p className="text-sm text-slate-500">{sale.customerPhone}</p>}
            </div>
          )}

          {/* Cheque Details — shown only for cheque payments */}
          {sale.paymentType === "cheque" && (sale.chequeNumber || sale.bankName) && (
            <div className="mb-5 p-3 bg-purple-50 rounded-xl border border-purple-200 print:border-purple-300 print:bg-white">
              <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-2">Cheque Details</p>
              <div className="space-y-1">
                {sale.chequeNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Cheque No.</span>
                    <span className="font-mono font-semibold text-slate-800">{sale.chequeNumber}</span>
                  </div>
                )}
                {sale.bankName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Bank</span>
                    <span className="font-semibold text-slate-800">{sale.bankName}</span>
                  </div>
                )}
                {sale.chequeHolderName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Holder Name</span>
                    <span className="font-semibold text-slate-800">{sale.chequeHolderName}</span>
                  </div>
                )}
                {sale.chequeDueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(sale.chequeDueDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="mb-5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-200 mb-2">
              <span className="flex-1">Item</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-16 text-right">Price</span>
              <span className="w-16 text-right">Total</span>
            </div>
            <div className="space-y-2">
              {sale.items.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm">
                  <span className="flex-1 text-slate-800 font-medium pr-2 leading-tight">{item.productName}</span>
                  <span className="w-10 text-center text-slate-500">{item.quantity}</span>
                  <span className="w-16 text-right text-slate-500">ج.م {item.unitPrice.toFixed(2)}</span>
                  <span className="w-16 text-right font-semibold text-slate-800">ج.م {item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>ج.م {sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount && sale.discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount ({sale.discount}%)</span>
                <span>-ج.م {discountAmount.toFixed(2)}</span>
              </div>
            )}
            {sale.specialDiscount && sale.specialDiscount > 0 && (
              <div className="flex justify-between text-sm text-purple-600">
                <span>Special Discount</span>
                <span>-ج.م {sale.specialDiscount.toFixed(2)}</span>
              </div>
            )}
            {sale.taxRate && sale.taxRate > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Tax — VAT ({sale.taxRate}%)</span>
                <span>+ج.م {taxAmt.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
              <span>TOTAL</span>
              <span>ج.م {sale.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 print:border-slate-300 print:bg-white">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600">{sale.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-200 text-center">
            <p className="text-sm font-semibold text-slate-700">Thank you for your purchase!</p>
            <p className="text-xs text-slate-400 mt-1">Please keep this receipt for your records.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
