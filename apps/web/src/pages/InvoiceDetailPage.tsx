import { ArrowLeft, CheckCircle2, Copy, Download, Edit3, Eye, FileWarning, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Money } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorState, LoadingState } from "../components/States";
import { api, pdfUrl } from "../lib/api";
import type { InvoiceDetail } from "../lib/types";

function isZero(value: string): boolean {
  return /^0(?:\.0+)?$/.test(value);
}

function eventReason(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || !("reason" in metadata)) return null;
  const reason = (metadata as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

export function InvoiceDetailPage() {
  const { invoiceId = "" } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    try {
      setInvoice(await api<InvoiceDetail>(`/invoices/${invoiceId}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load invoice.");
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!voidDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVoidDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [voidDialogOpen]);

  const duplicate = async () => {
    setBusyAction("duplicate");
    setActionError("");
    try {
      const copy = await api<InvoiceDetail>(`/invoices/${invoiceId}/duplicate`, { method: "POST" });
      navigate(`/invoices/${copy.id}/edit`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to duplicate invoice.");
    } finally {
      setBusyAction(null);
    }
  };

  const changeStatus = async (status: string, reason: string | null = null) => {
    if (!invoice) return;
    setBusyAction(status);
    setActionError("");
    try {
      setInvoice(
        await api<InvoiceDetail>(`/invoices/${invoice.id}/status`, {
          method: "POST",
          body: JSON.stringify({ status, version: invoice.version, reason }),
        }),
      );
      if (status === "VOID") {
        setVoidDialogOpen(false);
        setVoidReason("");
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update invoice status.");
    } finally {
      setBusyAction(null);
    }
  };

  const finalize = async () => {
    if (!invoice) return;
    setBusyAction("finalize");
    setActionError("");
    try {
      setInvoice(
        await api<InvoiceDetail>(`/invoices/${invoice.id}/finalize`, {
          method: "POST",
          body: JSON.stringify({ version: invoice.version }),
        }),
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to finalize invoice.");
    } finally {
      setBusyAction(null);
    }
  };

  if (!invoice && !error) return <LoadingState label="Loading invoice" />;
  if (!invoice) return <ErrorState message={error} onRetry={() => void load()} />;

  const customerName = invoice.customer?.companyName ?? invoice.customer?.name ?? "Unassigned customer";
  return (
    <div className="page-stack">
      <header className="detail-header">
        <div>
          <Link className="back-link" to="/invoices">
            <ArrowLeft size={17} />
            Invoices
          </Link>
          <div className="title-with-status">
            <h1>{invoice.number ?? "Draft invoice"}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p>
            {customerName} · Issued {invoice.issueDate} · Due {invoice.dueDate}
          </p>
        </div>
        <div className="header-actions">
          {invoice.status === "DRAFT" ? (
            <>
              <Link className="button secondary" to={`/invoices/${invoice.id}/edit`}>
                <Edit3 size={17} />
                Edit
              </Link>
              <a className="button secondary" href={pdfUrl(invoice.id, true)} target="_blank" rel="noreferrer">
                <Eye size={17} />
                Preview PDF
              </a>
              <button className="button primary" disabled={busyAction !== null} onClick={() => void finalize()}>
                {busyAction === "finalize" ? "Finalizing…" : "Finalize"}
              </button>
            </>
          ) : invoice.status === "CANCELLED" ? null : (
            <>
              <a className="button secondary" href={pdfUrl(invoice.id, true)} target="_blank" rel="noreferrer">
                <Eye size={17} />
                Preview PDF
              </a>
              <a className="button primary" href={pdfUrl(invoice.id)}>
                <Download size={17} />
                Download PDF
              </a>
            </>
          )}
          <button className="button secondary" disabled={busyAction !== null} onClick={() => void duplicate()}>
            <Copy size={17} />
            {busyAction === "duplicate" ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </header>

      {actionError ? (
        <div className="alert error" role="alert">
          {actionError}
        </div>
      ) : null}

      <div className="detail-layout">
        <section className="invoice-document card">
          <div className="document-top">
            <div>
              <span className="eyebrow">Bill to</span>
              <h2>{customerName}</h2>
              <p>{invoice.customer?.name !== customerName ? invoice.customer?.name : ""}</p>
            </div>
            <dl className="document-meta">
              <div>
                <dt>Invoice</dt>
                <dd>{invoice.number ?? "Draft"}</dd>
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{invoice.issueDate}</dd>
              </div>
              <div>
                <dt>Due date</dt>
                <dd>{invoice.dueDate}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{invoice.currency}</dd>
              </div>
            </dl>
          </div>
          {invoice.projectReference || invoice.purchaseOrderNumber ? (
            <div className="reference-strip">
              {invoice.projectReference ? (
                <span>
                  <strong>Project</strong>
                  {invoice.projectReference}
                </span>
              ) : null}
              {invoice.purchaseOrderNumber ? (
                <span>
                  <strong>Purchase order</strong>
                  {invoice.purchaseOrderNumber}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="table-wrap">
            <table className="invoice-items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="number">Qty</th>
                  <th className="number">Unit price</th>
                  <th className="number">Discount</th>
                  <th className="number">Tax</th>
                  <th className="number">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.description}</strong>
                    </td>
                    <td className="number">{item.quantity}</td>
                    <td className="number">
                      <Money value={item.unitPrice} currency={invoice.currency} />
                    </td>
                    <td className="number">
                      {isZero(item.discountAmount) ? (
                        "—"
                      ) : (
                        <Money value={item.discountAmount} currency={invoice.currency} />
                      )}
                    </td>
                    <td className="number">
                      {isZero(item.taxRate) ? "—" : `${item.taxName ?? "Tax"} ${item.taxRate}%`}
                    </td>
                    <td className="number">
                      <strong>
                        <Money value={item.lineTotal} currency={invoice.currency} />
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="document-summary">
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>
                  <Money value={invoice.itemsSubtotal} currency={invoice.currency} />
                </dd>
              </div>
              {!isZero(invoice.discountTotal) ? (
                <div>
                  <dt>Discounts</dt>
                  <dd>
                    −<Money value={invoice.discountTotal} currency={invoice.currency} />
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Tax</dt>
                <dd>
                  <Money value={invoice.taxTotal} currency={invoice.currency} />
                </dd>
              </div>
              <div className="grand-total">
                <dt>Total</dt>
                <dd>
                  <Money value={invoice.grandTotal} currency={invoice.currency} />
                </dd>
              </div>
            </dl>
          </div>
          <div className="document-notes">
            <div>
              <h3>Notes</h3>
              <p>{invoice.notes || "No customer notes."}</p>
            </div>
            <div>
              <h3>Payment terms</h3>
              <p>{invoice.paymentTerms || "No payment terms."}</p>
            </div>
          </div>
        </section>

        <aside className="detail-sidebar">
          <section className="card">
            <h2>Actions</h2>
            <div className="action-stack">
              {invoice.status === "FINALIZED" || invoice.status === "OVERDUE" ? (
                <button
                  className="button success full"
                  disabled={busyAction !== null}
                  onClick={() => void changeStatus("PAID")}
                >
                  <CheckCircle2 size={17} />
                  {busyAction === "PAID" ? "Updating…" : "Mark paid"}
                </button>
              ) : null}
              {invoice.status === "DRAFT" ? (
                <button
                  className="button danger-outline full"
                  disabled={busyAction !== null}
                  onClick={() => void changeStatus("CANCELLED")}
                >
                  <XCircle size={17} />
                  {busyAction === "CANCELLED" ? "Cancelling…" : "Cancel draft"}
                </button>
              ) : null}
              {["FINALIZED", "OVERDUE", "PAID"].includes(invoice.status) ? (
                <button
                  className="button danger-outline full"
                  disabled={busyAction !== null}
                  onClick={() => setVoidDialogOpen(true)}
                >
                  <FileWarning size={17} />
                  Void invoice
                </button>
              ) : null}
            </div>
          </section>
          {invoice.internalNotes ? (
            <section className="card internal-note">
              <span className="eyebrow">Private</span>
              <h2>Internal notes</h2>
              <p>{invoice.internalNotes}</p>
            </section>
          ) : null}
          <section className="card">
            <h2>History</h2>
            <ol className="timeline">
              {invoice.events.map((event) => {
                const reason = eventReason(event.metadata);
                return (
                  <li key={event.id}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{event.eventType.replaceAll("_", " ").toLowerCase()}</strong>
                      <p>
                        {event.actorName} · {new Date(event.createdAt).toLocaleString()}
                      </p>
                      {event.previousStatus && event.newStatus ? (
                        <span>
                          {event.previousStatus} → {event.newStatus}
                        </span>
                      ) : null}
                      {reason ? <span className="timeline-reason">“{reason}”</span> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>

      {voidDialogOpen ? (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="void-invoice-title">
          <button
            className="modal-backdrop"
            aria-label="Close void invoice dialog"
            onClick={() => setVoidDialogOpen(false)}
          />
          <form
            className="modal-card confirmation-card"
            onSubmit={(event) => {
              event.preventDefault();
              if (voidReason.trim()) void changeStatus("VOID", voidReason.trim());
            }}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow danger-eyebrow">Permanent action</span>
                <h2 id="void-invoice-title">Void this invoice?</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setVoidDialogOpen(false)}>
                <XCircle />
              </button>
            </div>
            <p>
              Voiding preserves the invoice and audit history, but marks it as invalid. Add a reason for the record.
            </p>
            <label className="field">
              <span>Reason</span>
              <textarea
                autoFocus
                rows={4}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                required
                maxLength={1000}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setVoidDialogOpen(false)}>
                Keep invoice
              </button>
              <button className="button danger" disabled={!voidReason.trim() || busyAction !== null}>
                {busyAction === "VOID" ? "Voiding…" : "Void invoice"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
