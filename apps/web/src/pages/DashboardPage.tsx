import { AlertTriangle, CheckCircle2, Clock3, FileText, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Money } from "../components/Money";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorState, LoadingState } from "../components/States";
import { api } from "../lib/api";
import type { DashboardData } from "../lib/types";

const cards = [
  { status: "DRAFT", label: "Draft invoices", icon: FileText },
  { status: "FINALIZED", label: "Outstanding", icon: Clock3 },
  { status: "PAID", label: "Paid", icon: CheckCircle2 },
  { status: "OVERDUE", label: "Overdue", icon: AlertTriangle },
];

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api<DashboardData>("/dashboard"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data && !error) return <LoadingState label="Loading dashboard" />;
  if (!data) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Dashboard</h1>
          <p>Track current invoices and continue recent work.</p>
        </div>
        <Link className="button primary" to="/invoices/new">
          <Plus size={18} />
          New invoice
        </Link>
      </header>

      <section className="metric-grid" aria-label="Invoice summary">
        {cards.map(({ status, label, icon: Icon }) => {
          const records = data.summaries.filter((item) => item.status === status);
          const count = records.reduce((sum, item) => sum + item.count, 0);
          return (
            <article className={`metric-card metric-${status.toLowerCase()}`} key={status}>
              <div className="metric-heading">
                <span>{label}</span>
                <Icon size={20} />
              </div>
              <strong className="metric-value">{count}</strong>
              <div className="metric-amounts">
                {records.length ? (
                  records.map((item) => (
                    <span key={item.currency}>
                      <Money value={item.total} currency={item.currency} />
                    </span>
                  ))
                ) : (
                  <span>No balance</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Recent invoices</h2>
            <p>Your latest created or updated invoices.</p>
          </div>
          <Link to="/invoices" className="text-link">
            View all
          </Link>
        </div>
        {data.recent.length ? (
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="number">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice">
                      <Link className="strong-link" to={`/invoices/${invoice.id}`}>
                        {invoice.number ?? "Draft"}
                      </Link>
                    </td>
                    <td data-label="Customer">
                      {invoice.customer?.companyName ?? invoice.customer?.name ?? "Unassigned"}
                    </td>
                    <td data-label="Due">{invoice.dueDate}</td>
                    <td data-label="Status">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td data-label="Total" className="number">
                      <Money value={invoice.total} currency={invoice.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="compact-empty">No invoices yet. Create the first one to populate this dashboard.</div>
        )}
      </section>
    </div>
  );
}
