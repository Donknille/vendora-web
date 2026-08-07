"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileText,
  Download,
  Ban,
  ChevronDown,
  Calendar,
  Mail,
  MapPin,
} from "lucide-react";
import { useOrders, useUpdateOrder, useDeleteOrder } from "@/lib/hooks/useOrders";
import { useInvoices, useIssueInvoice, useCancelInvoice } from "@/lib/hooks/useInvoices";
import { useProfile } from "@/lib/hooks/useProfile";
import { useLanguage } from "@/lib/context/LanguageContext";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/formatCurrency";
import { isInvoiceReadyProfile } from "@/lib/invoice";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";

const ORDER_STATUSES = ["open", "paid", "shipped", "delivered", "cancelled"];

export default function OrderDetailPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: orders, isLoading, isError, refetch } = useOrders();
  const { data: invoices } = useInvoices();
  // Nur fuer das Ausstell-Gate. Bewusst nicht in isLoading/isError: ein Fehler
  // hier darf die Auftragsseite nicht ersetzen.
  const { data: profile } = useProfile();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const issueInvoice = useIssueInvoice();
  const cancelInvoice = useCancelInvoice();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState("");

  const order = orders?.find((o) => o.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.orders.noOrders}</p>
      </div>
    );
  }

  const items = order.items || [];
  const subtotal = items.reduce(
    (sum: number, item) =>
      sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
  const shippingCost = order.shippingCost ?? 0;
  const total = subtotal + shippingCost;

  // Invoices issued for this order (newest first). At most one is "active"
  // (issued, not a cancellation); the rest are cancellations / cancelled originals.
  const orderInvoices = (invoices || []).filter((inv) => inv.orderId === order.id);
  const activeInvoice = orderInvoices.find(
    (inv) => inv.type === "invoice" && inv.status === "issued"
  );
  // Dieselbe Regel wie serverseitig in issueInvoice — Button und Endpoint
  // koennen dadurch nicht auseinanderlaufen.
  const profileReady = isInvoiceReadyProfile(profile);

  const handleStatusChange = async (newStatus: string) => {
    setShowStatusMenu(false);
    setError("");
    try {
      await updateOrder.mutateAsync({ id: order.id, status: newStatus });
    } catch (e) {
      setError(apiErrorMessage(e, language, t.orders.statusChangeError));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOrder.mutateAsync(order.id);
      router.push("/orders");
    } catch (e) {
      setError(apiErrorMessage(e, language, t.orders.deleteError));
    }
  };

  const handleIssueInvoice = async () => {
    setError("");
    try {
      await issueInvoice.mutateAsync(order.id);
    } catch {
      setError(t.orders.invoiceActionError);
    }
  };

  const handleCancelInvoice = async () => {
    setShowCancelDialog(false);
    setError("");
    if (!activeInvoice) return;
    try {
      await cancelInvoice.mutateAsync(activeInvoice.id);
    } catch {
      setError(t.orders.invoiceActionError);
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
          <h1 className="text-2xl font-bold text-primary">
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

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
      )}

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
                  {formatDate(order.orderDate || order.createdAt?.split("T")[0] || "", language === "de" ? "de-DE" : "en-US")}
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

        {/* Totals */}
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {shippingCost !== 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">{t.orders.invoiceSubtotal}</span>
                <span className="text-primary">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">{t.orders.shippingCostLabel}</span>
                <span className="text-primary">{formatCurrency(shippingCost)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="font-medium text-secondary">{t.orders.total}</span>
            <span className="text-lg font-bold text-green-600">
              {formatCurrency(total)}
            </span>
          </div>
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

        {/* Invoice */}
        <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <FileText className="h-4 w-4 text-faint" />
            {t.orders.invoiceHeading}
          </div>

          {orderInvoices.length === 0 && (
            <p className="text-sm text-muted">{t.orders.noInvoiceYet}</p>
          )}

          {orderInvoices.map((inv) => {
            const cancelled = inv.type === "cancellation" || inv.status === "cancelled";
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line-subtle px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">#{inv.invoiceNumber}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        cancelled
                          ? "bg-red-500/10 text-red-400"
                          : "bg-green-500/10 text-green-500"
                      }`}
                    >
                      {cancelled ? t.orders.invoiceCancelled : t.orders.invoiceIssued}
                    </span>
                  </div>
                  <div className="text-xs text-faint">
                    {inv.issueDate} · {formatCurrency(inv.total)}
                  </div>
                </div>
                <a
                  href={`/api/invoices/${inv.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-primary hover:bg-elevated transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t.orders.downloadPdf}
                </a>
              </div>
            );
          })}

          {activeInvoice ? (
            <button
              onClick={() => setShowCancelDialog(true)}
              disabled={cancelInvoice.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60"
            >
              <Ban className="h-4 w-4" />
              {t.orders.cancelInvoice}
            </button>
          ) : profileReady ? (
            <>
              <button
                onClick={handleIssueInvoice}
                disabled={issueInvoice.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {t.orders.issueInvoice}
              </button>
              {/* Nicht blockierend: die Steuernummer ist erst ab 250 € Pflicht. */}
              {!profile?.taxNote?.trim() && (
                <p className="text-xs text-muted">
                  {language === "de"
                    ? "Hinweis: Im Firmenprofil ist kein Steuerhinweis hinterlegt. Ab 250 € Rechnungsbetrag ist die Steuernummer oder USt-IdNr. Pflicht."
                    : "Note: no tax reference is set in your company profile. From €250 the tax number or VAT ID is mandatory."}
                </p>
              )}
            </>
          ) : (
            /* § 14 Abs. 4 UStG: ohne Absender keine Rechnung. Der Server lehnt
               das ohnehin mit 409 ab — hier steht, wie man es behebt. */
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-sm text-amber-600">
                {language === "de"
                  ? "Zum Ausstellen fehlen Firmenname und Anschrift — sie müssen nach § 14 Abs. 4 UStG auf jeder Rechnung stehen."
                  : "Issuing requires your company name and address — every invoice must show them by law."}
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-primary hover:bg-elevated transition-colors"
              >
                {language === "de" ? "Firmenprofil vervollständigen" : "Complete company profile"}
              </Link>
            </div>
          )}
        </div>

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

      {/* Cancel Invoice (Storno) Confirm Dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelInvoice}
        title={t.orders.invoiceCancelTitle}
        message={t.orders.invoiceCancelConfirm}
        confirmText={t.orders.invoiceCancelAction}
        cancelText={t.orders.deleteCancel}
      />
    </div>
  );
}
