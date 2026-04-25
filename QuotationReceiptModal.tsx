import { useRef } from "react";
import { X, Printer, Download, FileText } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import jsPDF from "jspdf";

interface QuotationItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuotationReceiptProps {
  quotation: {
    _id: Id<"quotations">;
    _creationTime: number;
    storeId: Id<"stores">;
    quotationNumber: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    items: QuotationItem[];
    subtotal: number;
    discount?: number;
    total: number;
    notes?: string;
    status: string;
    validUntil?: string;
  };
  store?: {
    name: string;
    address?: string;
    phone?: string;
  } | null;
  onClose: () => void;
}

export default function QuotationReceiptModal({ quotation, store, onClose }: QuotationReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("QUOTATION", pageW / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(store?.name ?? "POS System", pageW / 2, y, { align: "center" });
    y += 5;
    if (store?.address) {
      doc.setFontSize(9);
      doc.text(store.address, pageW / 2, y, { align: "center" });
      y += 4;
    }
    if (store?.phone) {
      doc.setFontSize(9);
      doc.text(`Tel: ${store.phone}`, pageW / 2, y, { align: "center" });
      y += 4;
    }
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 8;

    // Meta
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Quotation No: ${quotation.quotationNumber}`, 15, y);
    doc.text(`Date: ${new Date(quotation._creationTime).toLocaleDateString()}`, pageW - 15, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Status: ${quotation.status.toUpperCase()}`, 15, y);
    if (quotation.validUntil) {
      doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString()}`, pageW - 15, y, { align: "right" });
    }
    y += 10;

    // Bill To
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 15, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(quotation.customerName, 15, y); y += 5;
    if (quotation.customerPhone) { doc.text(`Phone: ${quotation.customerPhone}`, 15, y); y += 5; }
    if (quotation.customerEmail) { doc.text(`Email: ${quotation.customerEmail}`, 15, y); y += 5; }
    y += 5;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pageW - 30, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Description", 17, y + 5);
    doc.text("Qty", pageW - 65, y + 5, { align: "right" });
    doc.text("Unit Price", pageW - 40, y + 5, { align: "right" });
    doc.text("Amount", pageW - 15, y + 5, { align: "right" });
    y += 9;

    doc.setFont("helvetica", "normal");
    for (const item of quotation.items) {
      doc.text(item.productName.substring(0, 50), 17, y);
      doc.text(String(item.quantity), pageW - 65, y, { align: "right" });
      doc.text(`EGP ${item.unitPrice.toFixed(2)}`, pageW - 40, y, { align: "right" });
      doc.text(`EGP ${item.total.toFixed(2)}`, pageW - 15, y, { align: "right" });
      y += 6;
      if (y > 260) { doc.addPage(); y = 20; }
    }

    y += 4;
    doc.line(15, y, pageW - 15, y);
    y += 6;

    // Totals
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Subtotal:", pageW - 55, y, { align: "right" });
    doc.text(`EGP ${quotation.subtotal.toFixed(2)}`, pageW - 15, y, { align: "right" });
    y += 6;
    const discountAmount = quotation.discount ? (quotation.subtotal * quotation.discount) / 100 : 0;
    if (quotation.discount && quotation.discount > 0) {
      doc.text(`Discount (${quotation.discount}%):`, pageW - 55, y, { align: "right" });
      doc.text(`-EGP ${discountAmount.toFixed(2)}`, pageW - 15, y, { align: "right" });
      y += 6;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL:", pageW - 55, y, { align: "right" });
    doc.text(`EGP ${quotation.total.toFixed(2)}`, pageW - 15, y, { align: "right" });
    y += 10;

    // Terms
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Terms & Conditions:", 15, y); y += 4;
    doc.text("This quotation is valid for the period stated above. Prices are subject to change after the validity date.", 15, y, { maxWidth: pageW - 30 });

    doc.save(`${quotation.quotationNumber}.pdf`);
  };

  const date = new Date(quotation._creationTime);
  const discountAmount = quotation.discount ? (quotation.subtotal * quotation.discount) / 100 : 0;

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up print:shadow-none print:rounded-none print:max-w-none print:w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Quotation</h2>
              <p className="text-xs text-slate-400">{quotation.quotationNumber}</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
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
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 print:bg-black">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Quotation</p>
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

          {/* Quotation Meta */}
          <div className="mb-5">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Quotation No.</span>
              <span className="text-sm font-bold text-slate-800 font-mono">{quotation.quotationNumber}</span>
            </div>
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Date Issued</span>
              <span className="text-sm text-slate-700">{date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
            {quotation.validUntil && (
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Valid Until</span>
                <span className="text-sm font-semibold text-amber-600">
                  {new Date(quotation.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[quotation.status] ?? "bg-slate-100 text-slate-700"}`}>
                {quotation.status}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bill To</p>
            <p className="text-sm font-bold text-slate-800">{quotation.customerName}</p>
            {quotation.customerPhone && (
              <p className="text-sm text-slate-500 mt-0.5">{quotation.customerPhone}</p>
            )}
            {quotation.customerEmail && (
              <p className="text-sm text-slate-500 mt-0.5">{quotation.customerEmail}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-5">
            <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 border-b border-slate-200 mb-2">
              <span className="flex-1">Description</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-16 text-right">Unit Price</span>
              <span className="w-16 text-right">Amount</span>
            </div>
            <div className="space-y-2.5">
              {quotation.items.map((item, i) => (
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
              <span>ج.م {quotation.subtotal.toFixed(2)}</span>
            </div>
            {quotation.discount && quotation.discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Discount ({quotation.discount}%)</span>
                <span>-ج.م {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
              <span>TOTAL</span>
              <span>ج.م {quotation.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 print:border-slate-300 print:bg-white">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600">{quotation.notes}</p>
            </div>
          )}

          {/* Terms */}
          <div className="mt-5 p-3 bg-amber-50 rounded-xl border border-amber-100 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 print:text-slate-500">Terms & Conditions</p>
            <p className="text-xs text-amber-600 print:text-slate-500">
              This quotation is valid for the period stated above. Prices are subject to change after the validity date.
              {quotation.validUntil ? ` This offer expires on ${new Date(quotation.validUntil).toLocaleDateString()}.` : ""}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-200 text-center">
            <p className="text-sm font-semibold text-slate-700">Thank you for your interest!</p>
            <p className="text-xs text-slate-400 mt-1">For inquiries, please contact us at the details above.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
