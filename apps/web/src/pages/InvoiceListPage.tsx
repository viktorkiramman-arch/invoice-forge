import { Copy, Download, FileText, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Money } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { api, pdfUrl } from "../lib/api";
import type { InvoiceListResponse } from "../lib/types";

export function InvoiceListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      params.set("sort", sort);
      setData(await api<InvoiceListResponse>(`/invoices?${params}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const duplicate = async (invoiceId: string) => {
    try {
      const copy = await api<{ id: string }>(`/invoices/${invoiceId}/duplicate`, { method: "POST" });
      navigate(`/invoices/${copy.id}/edit`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to duplicate invoice.");
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Billing history</span>
          <h1>Invoices</h1>
          <p>Search, review, duplicate, and download invoices.</p>
        </div>
        <Link className="button primary" to="/invoices/new">
          <Plus size={18} />
          New invoice
        </Link>
      </header>

      <section className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search invoices</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search number or customer"
          />
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="FINALIZED">Finalized</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="VOID">Void</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort invoices</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="due">Due date</option>
            <option value="total">Highest total</option>
          </select>
        </label>
      </section>

      {loading && !data ? (
        <LoadingState label="Loading invoices" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data && data.items.length ? (
        <section className="card flush-card">
          <div className="table-wrap responsive-table invoice-history-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Issue date</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th className="number">Total</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice">
                      <Link className="strong-link" to={`/invoices/${invoice.id}`}>
                        {invoice.number ?? "Draft"}
                      </Link>
                    </td>
                    <td data-label="Customer">
                      {invoice.customer?.companyName ?? invoice.customer?.name ?? "Unassigned"}
                    </td>
                    <td data-label="Issued">{invoice.issueDate}</td>
                    <td data-label="Due">{invoice.dueDate}</td>
                    <td data-label="Status">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td data-label="Total" className="number">
                      <Money value={invoice.grandTotal} currency={invoice.currency} />
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Duplicate ${invoice.number ?? "draft invoice"}`}
                          title="Duplicate invoice"
                          onClick={() => void duplicate(invoice.id)}
                        >
                          <Copy size={17} />
                        </button>
                        {invoice.status !== "CANCELLED" ? (
                          <a
                            className="icon-button"
                            aria-label={`Download ${invoice.number ?? "draft invoice"} PDF`}
                            title="Download PDF"
                            href={pdfUrl(invoice.id)}
                          >
                            <Download size={17} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {data.total} invoice{data.total === 1 ? "" : "s"}
            </span>
            <div>
              <button
                className="button secondary small"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(data.pages, 1)}
              </span>
              <button
                className="button secondary small"
                disabled={page >= data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          title="No invoices found"
          description={
            search || status
              ? "Clear the filters or use a different search."
              : "Create the first invoice for this business."
          }
          action={
            <Link className="button primary" to="/invoices/new">
              <FileText size={18} />
              Create invoice
            </Link>
          }
        />
      )}
    </div>
  );
}
