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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  const order = orders?.find((o) => o.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.orders.noOrders}</p>
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
    const pName = escapeHtml(profile?.name || "");
    const pAddress = escapeHtml(profile?.address || "").replace(/\n/g, "<br/>");
    const pEmail = escapeHtml(profile?.email || "");
    const pPhone = escapeHtml(profile?.phone || "");
    const pTaxNote = escapeHtml(profile?.taxNote || "");
    const pSmallBiz = escapeHtml(profile?.smallBusinessNote || "");

    const invoiceNum = escapeHtml(order.invoiceNumber || `INV-${order.id?.slice(0, 8)?.toUpperCase() || "0000"}`);
    const invoiceDate = order.orderDate || order.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
    const serviceDate = order.serviceDate || invoiceDate;
    const shippingCost = order.shippingCost ?? 0;
    const subtotal = items.reduce((s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity, 0);
    const grandTotal = subtotal + shippingCost;

    const customerAddress = escapeHtml(order.customerStreet || "") + "<br/>" + escapeHtml(order.customerZip || "") + " " + escapeHtml(order.customerCity || "") + (order.customerCountry ? "<br/>" + escapeHtml(order.customerCountry) : "");

    const itemRows = items
      .map(
        (item: { name: string; quantity: number; price: number }, idx: number) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;">${idx + 1}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;">${escapeHtml(item.name)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;text-align:center;">${item.quantity || 1}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;text-align:right;">${formatCurrency(Number(item.price || 0))}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;text-align:right;font-weight:500;">${formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</td>
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
    body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; background:#fff; color:#1f2937; padding:0; }
    .page { max-width:800px; margin:0 auto; padding:48px 48px 32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:48px; border-bottom:3px solid #10b981; padding-bottom:24px; }
    .brand { }
    .brand-name { font-size:24px; font-weight:700; color:#10b981; margin-bottom:4px; }
    .brand-details { font-size:12px; color:#6b7280; line-height:1.6; }
    .invoice-meta { text-align:right; }
    .invoice-title { font-size:28px; font-weight:700; color:#1f2937; letter-spacing:-0.5px; }
    .invoice-meta-table { margin-top:8px; }
    .invoice-meta-table td { font-size:13px; padding:2px 0; }
    .invoice-meta-table td:first-child { color:#6b7280; padding-right:12px; }
    .invoice-meta-table td:last-child { color:#1f2937; font-weight:600; text-align:right; }
    .parties { display:flex; justify-content:space-between; margin-bottom:36px; }
    .party { flex:1; }
    .party-label { font-size:11px; font-weight:600; color:#10b981; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px; }
    .party-name { font-size:15px; font-weight:600; color:#1f2937; margin-bottom:4px; }
    .party-details { font-size:13px; color:#6b7280; line-height:1.6; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    thead { background:#f9fafb; }
    th { padding:10px 16px; text-align:left; font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #e5e7eb; }
    th.right { text-align:right; }
    th.center { text-align:center; }
    .totals { display:flex; justify-content:flex-end; margin-bottom:32px; }
    .totals-table { width:280px; }
    .totals-table tr td { padding:6px 0; font-size:14px; }
    .totals-table tr td:first-child { color:#6b7280; }
    .totals-table tr td:last-child { text-align:right; color:#1f2937; font-weight:500; }
    .totals-table .grand-total td { padding-top:10px; border-top:2px solid #1f2937; font-size:16px; font-weight:700; }
    .totals-table .grand-total td:last-child { color:#10b981; }
    .notes { margin-top:24px; padding:16px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb; }
    .notes-label { font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
    .notes p { font-size:13px; color:#4b5563; line-height:1.5; white-space:pre-wrap; }
    .tax-notice { margin-top:24px; padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:12px; color:#166534; text-align:center; }
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; text-align:center; }
    .footer p { font-size:12px; color:#9ca3af; margin-bottom:4px; }
    .footer .thank-you { font-size:14px; color:#6b7280; font-weight:500; margin-bottom:8px; }
    @media print {
      body { padding:0; }
      .page { padding:24px 32px 16px; max-width:100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="brand-name">${pName || "Vendora"}</div>
        <div class="brand-details">
          ${pAddress ? pAddress + "<br/>" : ""}${pEmail ? pEmail + "<br/>" : ""}${pPhone ? "Tel. " + pPhone : ""}
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">${t.orders.invoiceTitle}</div>
        <table class="invoice-meta-table">
          <tr><td>${t.orders.invoiceNumber}:</td><td>${invoiceNum}</td></tr>
          <tr><td>${t.orders.invoiceDateLabel}:</td><td>${invoiceDate}</td></tr>
          <tr><td>${t.orders.serviceDateLabel}:</td><td>${serviceDate}</td></tr>
        </table>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">${t.orders.invoiceTo}</div>
        <div class="party-name">${escapeHtml(order.customerName)}</div>
        <div class="party-details">
          ${customerAddress ? customerAddress + "<br/>" : ""}${order.customerEmail ? escapeHtml(order.customerEmail) : ""}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px;">${t.orders.posLabel}</th>
          <th>${t.orders.invoiceItem}</th>
          <th class="center" style="width:60px;">${t.orders.invoiceQty}</th>
          <th class="right" style="width:120px;">${t.orders.invoiceUnitPrice}</th>
          <th class="right" style="width:120px;">${t.orders.invoiceAmount}</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals">
      <table class="totals-table">
        <tr><td>${t.orders.invoiceSubtotal}:</td><td>${formatCurrency(subtotal)}</td></tr>
        ${shippingCost > 0 ? `<tr><td>${t.orders.shippingCostLabel}:</td><td>${formatCurrency(shippingCost)}</td></tr>` : ""}
        <tr class="grand-total"><td>${t.orders.invoiceTotal}:</td><td>${formatCurrency(grandTotal)}</td></tr>
      </table>
    </div>

    ${pTaxNote || pSmallBiz ? `
    <div class="tax-notice">
      ${pTaxNote}${pTaxNote && pSmallBiz ? "<br/>" : ""}${pSmallBiz}
    </div>` : ""}

    ${order.notes ? `
    <div class="notes">
      <div class="notes-label">${t.orders.invoiceNotes}</div>
      <p>${escapeHtml(order.notes)}</p>
    </div>` : ""}

    <div class="footer">
      <p class="thank-you">${t.orders.invoiceThankYou}</p>
      <p>${pName || "Vendora"}${pEmail ? " · " + pEmail : ""}${pPhone ? " · Tel. " + pPhone : ""}</p>
    </div>
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
            className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold font-display text-primary">
            {t.orders.orderDetails}
          </h1>
        </div>
        <Link
          href={`/orders/${id}/edit`}
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <Pencil className="h-5 w-5" />
        </Link>
      </div>

      {/* Customer Card */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">
              {order.customerName}
            </h2>
            {order.status && <StatusBadge status={order.status} />}
          </div>

          <div className="space-y-2 text-sm text-faint">
            {order.invoiceNumber && (
              <p className="text-muted">#{order.invoiceNumber}</p>
            )}
            {(order.orderDate || order.createdAt) && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted" />
                <span>
                  {order.orderDate || order.createdAt?.split("T")[0]}
                </span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted" />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerStreet && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted mt-0.5" />
                <div>
                  <span>{order.customerStreet}, {order.customerZip} {order.customerCity}</span>
                  {order.customerCountry && (
                    <div>{order.customerCountry}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Items Table */}
      <Card>
        <h2 className="text-sm font-medium text-faint uppercase tracking-wider mb-4">
          {t.orders.items}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="pb-2 text-left font-medium text-muted">
                  {t.orders.invoiceItem}
                </th>
                <th className="pb-2 text-center font-medium text-muted">
                  {t.orders.invoiceQty}
                </th>
                <th className="pb-2 text-right font-medium text-muted">
                  {t.orders.invoiceUnitPrice}
                </th>
                <th className="pb-2 text-right font-medium text-muted">
                  {t.orders.invoiceAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: { name: string; quantity: number; price: number }, index: number) => (
                <tr key={index} className="border-b border-line-subtle">
                  <td className="py-3 text-primary">{item.name}</td>
                  <td className="py-3 text-center text-faint">
                    {item.quantity || 1}
                  </td>
                  <td className="py-3 text-right text-faint">
                    {formatCurrency(Number(item.price || 0))}
                  </td>
                  <td className="py-3 text-right text-primary">
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
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="font-medium text-secondary">{t.orders.total}</span>
          <span className="text-lg font-bold font-display text-brand-tealDark">
            {formatCurrency(total)}
          </span>
        </div>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <h2 className="text-sm font-medium text-faint uppercase tracking-wider mb-2">
            {t.orders.notes}
          </h2>
          <p className="text-sm text-secondary whitespace-pre-wrap">
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
            className="w-full flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-primary hover:border-line-hover transition-colors"
          >
            <span>{t.orders.changeStatus}</span>
            <ChevronDown
              className={`h-4 w-4 text-faint transition-transform ${
                showStatusMenu ? "rotate-180" : ""
              }`}
            />
          </button>
          {showStatusMenu && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-line bg-surface py-1 shadow-xl">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    order.status === status
                      ? "bg-brand-primary/10 text-brand-primary"
                      : "text-secondary hover:bg-elevated"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {order.status === status && (
                      <span className="text-xs text-muted">
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
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-3 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
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
