import { forwardRef } from "react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalAmount: number;
}

interface PaymentInfo {
  method: string;
  amount: number;
  reference?: string;
}

interface ReceiptPreviewProps {
  orderNumber: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: PaymentInfo[];
  cashReceived?: number;
  changeAmount?: number;
  createdAt: Date;
}

export const ReceiptPreview = forwardRef<HTMLDivElement, ReceiptPreviewProps>(
  (
    {
      orderNumber,
      storeName,
      storeAddress,
      storePhone,
      customerName,
      customerPhone,
      items,
      subtotal,
      discount,
      tax,
      total,
      payments,
      cashReceived,
      changeAmount,
      createdAt,
    },
    ref
  ) => {
    const getPaymentMethodLabel = (method: string) => {
      const labels: Record<string, string> = {
        cash: "Cash",
        upi: "UPI",
        card: "Card",
        loyalty_points: "Loyalty Points",
        store_credit: "Store Credit",
      };
      return labels[method] || method;
    };

    return (
      <div
        ref={ref}
        className="w-[300px] bg-white text-black p-4 font-mono text-xs"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-lg font-bold">{storeName}</div>
          {storeAddress && <div className="text-[10px]">{storeAddress}</div>}
          {storePhone && <div className="text-[10px]">Tel: {storePhone}</div>}
        </div>

        <Separator className="my-2 border-dashed border-black" />

        {/* Order Info */}
        <div className="flex justify-between mb-1">
          <span>Order #:</span>
          <span className="font-bold">{orderNumber}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span>Date:</span>
          <span>{format(createdAt, "dd/MM/yyyy HH:mm")}</span>
        </div>
        {customerName && (
          <div className="flex justify-between mb-1">
            <span>Customer:</span>
            <span>{customerName}</span>
          </div>
        )}
        {customerPhone && (
          <div className="flex justify-between mb-1">
            <span>Phone:</span>
            <span>{customerPhone}</span>
          </div>
        )}

        <Separator className="my-2 border-dashed border-black" />

        {/* Items */}
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between">
                <span className="flex-1 truncate pr-2">{item.name}</span>
                <span>₹{item.totalAmount.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-gray-600 pl-2">
                {item.quantity} x ₹{item.unitPrice.toFixed(2)}
                {item.discountAmount > 0 && (
                  <span className="ml-2">(-₹{item.discountAmount.toFixed(2)})</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-2 border-dashed border-black" />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-₹{discount.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-dashed border-black pt-1">
            <span>TOTAL:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>

        <Separator className="my-2 border-dashed border-black" />

        {/* Payment Info */}
        <div className="space-y-1">
          <div className="font-bold">Payment:</div>
          {payments.map((payment, index) => (
            <div key={index} className="flex justify-between">
              <span>
                {getPaymentMethodLabel(payment.method)}
                {payment.reference && ` (${payment.reference})`}
              </span>
              <span>₹{payment.amount.toFixed(2)}</span>
            </div>
          ))}
          {cashReceived && cashReceived > total && (
            <>
              <div className="flex justify-between">
                <span>Cash Received:</span>
                <span>₹{cashReceived.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change:</span>
                <span>₹{changeAmount?.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <Separator className="my-2 border-dashed border-black" />

        {/* Footer */}
        <div className="text-center text-[10px] mt-4">
          <div>Thank you for shopping with us!</div>
          <div className="mt-1">Keep this receipt for returns/exchange</div>
          <div className="mt-2 text-gray-500">
            Powered by QuickApp
          </div>
        </div>
      </div>
    );
  }
);

ReceiptPreview.displayName = "ReceiptPreview";
