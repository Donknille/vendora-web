"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileText,
  ChevronDown,
  Calendar,
  Mail,
  MapPin,
  User,
} from "lucide-react";
import { useOrders, useUpdateOrder, useDeleteOrder } from "@/lib/hooks/useOrders";
import { useProfile } from "@/lib/hooks/useProfile";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const ORDER_STATUSES = ["open", "paid", "shipped", "delivered", "cancelled"];

export default function OrderDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: orders, isLoading } = useOrders();
  const { data: profile } = useProfile();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const order = orders?.find((o: any) => o.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.orders.noOrders}</p>
      </div>
    );
  }

  const items = order.items || [];
  const total = items.reduce(
    (sum: number, item: any) =>
      sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  const handleStatusChange = async (newStatus: string) => {
    setShowStatusMenu(false);
    await updateOrder.mutateAsync({ id: order.id, status: newStatus });
  };

  const handleDelete = async () => {
    await deleteOrder.mutateAsync(order.id);
    router.push("/orders");
  };

  const handleCreateInvoice = () => {
    const profileName = profile?.companyName || profile?.name || "Vendora";
    const profileAddress = profile?.address || "";
    const profileEmail = profile?.email || "";
    const profilePhone = profile?.phone || "";
    const taxNote = profile?.taxNote || "";

    const invoiceDate =
      order.orderDate || order.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
    const invoiceNum = order.invoiceNumber || `INV-${order.id?.slice(0, 8)?.toUpperCase() || "0000"}`;

    const itemRows = items
      .map(
        (item: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #27272a;color:#e4e4e7;">${item.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #27272a;color:#e4e4e7;text-align:center;">${item.quantity || 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #27272a;color:#e4e4e7;text-align:right;">${formatCurrency(Number(item.price || 0))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #27272a;color:#e4e4e7;text-align:right;">${formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${t.orders.invoiceTitle} ${invoiceNum}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#09090b; color:#e4e4e7; padding:40px; }
    .invoice { max-width:800px; margin:0 auto; background:#18181b; border:1px solid #27272a; border-radius:12px; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; }
    .title { font-size:28px; font-weight:700; color:#10b981; }
    .invoice-meta { text-align:right; }
    .invoice-meta p { font-size:14px; color:#a1a1aa; margin-bottom:4px; }
    .invoice-meta strong { color:#e4e4e7; }
    .parties { display:flex; justify-content:space-between; margin-bottom:32px; }
    .party { flex:1; }
    .party-label { font-size:12px; font-weight:600; color:#10b981; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
    .party p { font-size:14px; color:#a1a1aa; margin-bottom:2px; }
    .party p.name { color:#e4e4e7; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { padding:10px 12px; text-align:left; font-size:12px; font-weight:600; color:#10b981; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #27272a; }
    th.right { text-align:right; }
    th.center { text-align:center; }
    .total-row { display:flex; justify-content:flex-end; margin-bottom:32px; }
    .total-box { background:#10b981; color:#fff; padding:12px 24px; border-radius:8px; font-size:18px; font-weight:700; }
    .notes { margin-top:24px; padding:16px; background:#09090b; border-radius:8px; border:1px solid #27272a; }
    .notes-label { font-size:12px; font-weight:600; color:#10b981; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
    .notes p { font-size:14px; color:#a1a1aa; }
    .footer { margin-top:32px; text-align:center; font-size:12px; color:#52525b; }
    @media print { body { background:#fff; color:#18181b; padding:20px; } .invoice { background:#fff; border:1px solid #e4e4e7; } th { color:#18181b; border-bottom-color:#e4e4e7; } td { color:#18181b !important; border-bottom-color:#e4e4e7 !important; } .invoice-meta p { color:#52525b; } .invoice-meta strong { color:#18181b; } .party p { color:#52525b; } .party p.name { color:#18181b; } .notes { background:#f4f4f5; border-color:#e4e4e7; } .notes p { color:#52525b; } .footer { color:#a1a1aa; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="title">${t.orders.invoiceTitle}</div>
      <div class="invoice-meta">
        <p>${t.orders.invoiceNumber}: <strong>${invoiceNum}</strong></p>
        <p>${t.orders.invoiceDate}: <strong>${invoiceDate}</strong></p>
      </div>
    </div>
    <div class="parties">
      <div class="party">
        <div class="party-label">${t.orders.invoiceFrom}</div>
        <p class="name">${profileName}</p>
        ${profileAddress ? `<p>${profileAddress}</p>` : ""}
        ${profileEmail ? `<p>${profileEmail}</p>` : ""}
        ${profilePhone ? `<p>${profilePhone}</p>` : ""}
      </div>
      <div class="party" style="text-align:right;">
        <div class="party-label" style="text-align:right;">${t.orders.invoiceTo}</div>
        <p class="name">${order.customerName}</p>
        ${order.customerAddress ? `<p>${order.customerAddress}</p>` : ""}
        ${order.customerEmail ? `<p>${order.customerEmail}</p>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${t.orders.invoiceItem}</th>
          <th class="center">${t.orders.invoiceQty}</th>
          <th class="right">${t.orders.invoiceUnitPrice}</th>
          <th class="right">${t.orders.invoiceAmount}</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    <div class="total-row">
      <div class="total-box">${t.orders.invoiceTotal}: ${formatCurrency(total)}</div>
    </div>
    ${
      order.notes
        ? `<div class="notes"><div class="notes-label">${t.orders.invoiceNotes}</div><p>${order.notes}</p></div>`
        : ""
    }
    ${
      taxNote
        ? `<div class="footer">${taxNote}</div>`
        : ""
    }
    <div class="footer" style="margin-top:16px;">${t.orders.invoiceThankYou}</div>
  </div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;

    const invoiceWindow = window.open("", "_blank");
    if (invoiceWindow) {
      invoiceWindow.document.write(html);
      invoiceWindow.document.close();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="rounded-lg p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">
            {t.orders.orderDetails}
          </h1>
        </div>
        <Link
          href={`/orders/${id}/edit`}
          className="rounded-lg p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <Pencil className="h-5 w-5" />
        </Link>
      </div>

      {/* Customer Card */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              {order.customerName}
            </h2>
            {order.status && <StatusBadge status={order.status} />}
          </div>

          <div className="space-y-2 text-sm text-zinc-400">
            {order.invoiceNumber && (
              <p className="text-zinc-500">#{order.invoiceNumber}</p>
            )}
            {(order.orderDate || order.createdAt) && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <span>
                  {order.orderDate || order.createdAt?.split("T")[0]}
                </span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-zinc-500" />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-zinc-500" />
                <span>{order.customerAddress}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          {t.orders.items}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="pb-2 text-left font-medium text-zinc-500">
                  {t.orders.invoiceItem}
                </th>
                <th className="pb-2 text-center font-medium text-zinc-500">
                  {t.orders.invoiceQty}
                </th>
                <th className="pb-2 text-right font-medium text-zinc-500">
                  {t.orders.invoiceUnitPrice}
                </th>
                <th className="pb-2 text-right font-medium text-zinc-500">
                  {t.orders.invoiceAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <tr key={index} className="border-b border-zinc-800/50">
                  <td className="py-3 text-zinc-100">{item.name}</td>
                  <td className="py-3 text-center text-zinc-400">
                    {item.quantity || 1}
                  </td>
                  <td className="py-3 text-right text-zinc-400">
                    {formatCurrency(Number(item.price || 0))}
                  </td>
                  <td className="py-3 text-right text-zinc-100">
                    {formatCurrency(
                      Number(item.price || 0) * Number(item.quantity || 1)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="font-medium text-zinc-300">{t.orders.total}</span>
          <span className="text-lg font-bold text-emerald-400">
            {formatCurrency(total)}
          </span>
        </div>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">
            {t.orders.notes}
          </h2>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
            {order.notes}
          </p>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Status Change */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="w-full flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-zinc-700 transition-colors"
          >
            <span>{t.orders.changeStatus}</span>
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform ${
                showStatusMenu ? "rotate-180" : ""
              }`}
            />
          </button>
          {showStatusMenu && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    order.status === status
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {order.status === status && (
                      <span className="text-xs text-zinc-500">
                        ({t.orders.processingStatusDone})
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Invoice */}
        <button
          onClick={handleCreateInvoice}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
        >
          <FileText className="h-4 w-4" />
          {t.orders.createInvoice}
        </button>

        {/* Delete */}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {t.orders.deleteOrder}
        </button>
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={t.orders.deleteOrder}
        message={t.orders.deleteConfirm}
        confirmText={t.orders.deleteAction}
        cancelText={t.orders.deleteCancel}
      />
    </div>
  );
}
