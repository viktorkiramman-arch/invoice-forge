import { Archive, Edit3, Plus, RotateCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { api, ApiError } from "../lib/api";
import type { Customer } from "../lib/types";

type CustomerForm = Omit<Customer, "id" | "archivedAt" | "version" | "_count">;

const blankCustomer: CustomerForm = {
  name: "",
  companyName: null,
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  region: null,
  postalCode: null,
  country: null,
  taxIdentifier: null,
  internalNotes: null,
};

function value(value: string): string | null {
  return value.trim() || null;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(blankCustomer);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ archived: String(archived) });
      if (search.trim()) params.set("search", search.trim());
      setCustomers(await api<Customer[]>(`/customers?${params}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }, [archived, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const startCreate = () => {
    setEditing(null);
    setForm(blankCustomer);
    setFormError("");
    setOpen(true);
  };
  const startEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      companyName: customer.companyName,
      email: customer.email,
      phone: customer.phone,
      addressLine1: customer.addressLine1,
      addressLine2: customer.addressLine2,
      city: customer.city,
      region: customer.region,
      postalCode: customer.postalCode,
      country: customer.country,
      taxIdentifier: customer.taxIdentifier,
      internalNotes: customer.internalNotes,
    });
    setFormError("");
    setOpen(true);
  };

  const update = (field: keyof CustomerForm, fieldValue: string) =>
    setForm((current) => ({ ...current, [field]: field === "name" ? fieldValue : value(fieldValue) }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (editing)
        await api(`/customers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...form, version: editing.version }),
        });
      else await api("/customers", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      await load();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Unable to save customer.");
    } finally {
      setSubmitting(false);
    }
  };

  const archiveCustomer = async (customer: Customer) => {
    try {
      await api<void>(`/customers/${customer.id}/${archived ? "restore" : "archive"}`, { method: "POST" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update customer.");
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Address book</span>
          <h1>Customers</h1>
          <p>Keep billing details reusable without changing finalized invoices.</p>
        </div>
        <button className="button primary" onClick={startCreate}>
          <Plus size={18} />
          New customer
        </button>
      </header>
      <section className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <span className="sr-only">Search customers</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, company, or email"
          />
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Show archived
        </label>
      </section>

      {loading && !customers.length ? (
        <LoadingState label="Loading customers" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : customers.length ? (
        <section className="customer-grid">
          {customers.map((customer) => (
            <article className="customer-card" key={customer.id}>
              <div className="customer-card-heading">
                <div className="avatar large">{(customer.companyName ?? customer.name).slice(0, 2).toUpperCase()}</div>
                <div>
                  <h2>{customer.companyName ?? customer.name}</h2>
                  {customer.companyName ? <p>{customer.name}</p> : null}
                </div>
              </div>
              <dl className="details-list">
                <div>
                  <dt>Email</dt>
                  <dd>{customer.email ?? "—"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{[customer.city, customer.region, customer.country].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Invoices</dt>
                  <dd>{customer._count?.invoices ?? 0}</dd>
                </div>
              </dl>
              <div className="card-actions">
                <button className="button secondary small" onClick={() => startEdit(customer)}>
                  <Edit3 size={16} />
                  Edit
                </button>
                <button className="button tertiary small" onClick={() => void archiveCustomer(customer)}>
                  {archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                  {archived ? "Restore" : "Archive"}
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title={archived ? "No archived customers" : "No customers yet"}
          description={
            archived
              ? "Archived customer records will appear here."
              : "Add a customer before creating a finalized invoice."
          }
          action={
            !archived ? (
              <button className="button primary" onClick={startCreate}>
                <Plus size={18} />
                Add customer
              </button>
            ) : undefined
          }
        />
      )}

      {open ? (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
          <button className="modal-backdrop" aria-label="Close customer form" onClick={() => setOpen(false)} />
          <form className="modal-card customer-form" onSubmit={submit}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Customer record</span>
                <h2 id="customer-form-title">{editing ? "Edit customer" : "New customer"}</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            {formError ? (
              <div className="alert error" role="alert">
                {formError}
              </div>
            ) : null}
            <div className="form-grid two">
              <label className="field">
                <span>Contact name</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                  maxLength={200}
                />
              </label>
              <label className="field">
                <span>
                  Company <small>Optional</small>
                </span>
                <input value={form.companyName ?? ""} onChange={(event) => update("companyName", event.target.value)} />
              </label>
              <label className="field">
                <span>
                  Email <small>Optional</small>
                </span>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>
              <label className="field">
                <span>
                  Phone <small>Optional</small>
                </span>
                <input value={form.phone ?? ""} onChange={(event) => update("phone", event.target.value)} />
              </label>
              <label className="field span-two">
                <span>
                  Address line 1 <small>Optional</small>
                </span>
                <input
                  value={form.addressLine1 ?? ""}
                  onChange={(event) => update("addressLine1", event.target.value)}
                />
              </label>
              <label className="field span-two">
                <span>
                  Address line 2 <small>Optional</small>
                </span>
                <input
                  value={form.addressLine2 ?? ""}
                  onChange={(event) => update("addressLine2", event.target.value)}
                />
              </label>
              <label className="field">
                <span>City</span>
                <input value={form.city ?? ""} onChange={(event) => update("city", event.target.value)} />
              </label>
              <label className="field">
                <span>Region</span>
                <input value={form.region ?? ""} onChange={(event) => update("region", event.target.value)} />
              </label>
              <label className="field">
                <span>Postal code</span>
                <input value={form.postalCode ?? ""} onChange={(event) => update("postalCode", event.target.value)} />
              </label>
              <label className="field">
                <span>Country</span>
                <input value={form.country ?? ""} onChange={(event) => update("country", event.target.value)} />
              </label>
              <label className="field span-two">
                <span>
                  Tax identifier <small>Optional</small>
                </span>
                <input
                  value={form.taxIdentifier ?? ""}
                  onChange={(event) => update("taxIdentifier", event.target.value)}
                />
              </label>
              <label className="field span-two">
                <span>
                  Internal notes <small>Never shown on invoices</small>
                </span>
                <textarea
                  value={form.internalNotes ?? ""}
                  onChange={(event) => update("internalNotes", event.target.value)}
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="button primary" disabled={submitting}>
                {submitting ? "Saving…" : "Save customer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
