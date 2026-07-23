import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ErrorState, LoadingState } from "../components/States";
import { api, ApiError } from "../lib/api";
import type { Business, TaxRate } from "../lib/types";

export function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newRate, setNewRate] = useState({ name: "", rate: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [rateSubmitting, setRateSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [businessData, rateData] = await Promise.all([api<Business>("/business"), api<TaxRate[]>("/tax-rates")]);
      setBusiness(businessData);
      setRates(rateData);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load settings.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Business>(key: K, value: Business[K]) =>
    setBusiness((current) => (current ? { ...current, [key]: value } : current));

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 750_000) {
      setError("Logo must be a PNG, JPEG, or WebP image under 750 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!business) return;
    setNotice("");
    setError("");
    setSaving(true);
    try {
      setBusiness(await api<Business>("/business", { method: "PATCH", body: JSON.stringify(business) }));
      setNotice("Business settings saved.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const addRate = async (event: FormEvent) => {
    event.preventDefault();
    setRateSubmitting(true);
    setError("");
    try {
      await api("/tax-rates", { method: "POST", body: JSON.stringify(newRate) });
      setNewRate({ name: "", rate: "", isDefault: false });
      await load();
      setNotice("Tax rate added.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add tax rate.");
    } finally {
      setRateSubmitting(false);
    }
  };

  const removeRate = async (rateId: string) => {
    setError("");
    try {
      await api<void>(`/tax-rates/${rateId}`, { method: "DELETE" });
      await load();
      setNotice("Tax rate archived.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to archive tax rate.");
    }
  };

  if (!business && !error) return <LoadingState label="Loading settings" />;
  if (!business) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="page-stack settings-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Workspace configuration</span>
          <h1>Business settings</h1>
          <p>Defaults apply to new drafts. Finalized invoice snapshots do not change.</p>
        </div>
      </header>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}
      <form className="card settings-form" onSubmit={save}>
        <div className="section-heading">
          <div>
            <h2>Business identity</h2>
            <p>Sender details shown on invoices and PDF files.</p>
          </div>
          <button className="button primary" disabled={saving}>
            <Save size={17} />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
        <div className="logo-setting">
          <div className="logo-preview">
            {business.logoDataUrl ? <img src={business.logoDataUrl} alt="Business logo preview" /> : <span>IF</span>}
          </div>
          <div>
            <strong>Business logo</strong>
            <p>PNG, JPEG, or WebP. Maximum 750 KB.</p>
            <label className="button secondary small file-button">
              <ImagePlus size={16} />
              Choose logo
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
            </label>
            {business.logoDataUrl ? (
              <button type="button" className="button tertiary small" onClick={() => set("logoDataUrl", null)}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>Business name</span>
            <input value={business.name} onChange={(event) => set("name", event.target.value)} required />
          </label>
          <label className="field">
            <span>
              Legal name <small>Optional</small>
            </span>
            <input
              value={business.legalName ?? ""}
              onChange={(event) => set("legalName", event.target.value || null)}
            />
          </label>
          <label className="field">
            <span>Billing email</span>
            <input
              type="email"
              value={business.email ?? ""}
              onChange={(event) => set("email", event.target.value || null)}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={business.phone ?? ""} onChange={(event) => set("phone", event.target.value || null)} />
          </label>
          <label className="field span-two">
            <span>Address line 1</span>
            <input
              value={business.addressLine1 ?? ""}
              onChange={(event) => set("addressLine1", event.target.value || null)}
            />
          </label>
          <label className="field span-two">
            <span>Address line 2</span>
            <input
              value={business.addressLine2 ?? ""}
              onChange={(event) => set("addressLine2", event.target.value || null)}
            />
          </label>
          <label className="field">
            <span>City</span>
            <input value={business.city ?? ""} onChange={(event) => set("city", event.target.value || null)} />
          </label>
          <label className="field">
            <span>Region</span>
            <input value={business.region ?? ""} onChange={(event) => set("region", event.target.value || null)} />
          </label>
          <label className="field">
            <span>Postal code</span>
            <input
              value={business.postalCode ?? ""}
              onChange={(event) => set("postalCode", event.target.value || null)}
            />
          </label>
          <label className="field">
            <span>Country</span>
            <input value={business.country ?? ""} onChange={(event) => set("country", event.target.value || null)} />
          </label>
          <label className="field span-two">
            <span>Tax identifier</span>
            <input
              value={business.taxIdentifier ?? ""}
              onChange={(event) => set("taxIdentifier", event.target.value || null)}
            />
          </label>
        </div>

        <hr />
        <div className="section-heading">
          <div>
            <h2>Invoice defaults</h2>
            <p>Used when a new draft is created.</p>
          </div>
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>Default currency</span>
            <select value={business.defaultCurrency} onChange={(event) => set("defaultCurrency", event.target.value)}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>JPY</option>
              <option>KWD</option>
            </select>
          </label>
          <label className="field">
            <span>Tax mode</span>
            <select
              value={business.defaultTaxMode}
              onChange={(event) => set("defaultTaxMode", event.target.value as Business["defaultTaxMode"])}
            >
              <option value="EXCLUSIVE">Exclusive tax</option>
              <option value="INCLUSIVE">Inclusive tax</option>
            </select>
          </label>
          <label className="field">
            <span>Invoice prefix</span>
            <input
              value={business.invoicePrefix}
              onChange={(event) => set("invoicePrefix", event.target.value.toUpperCase())}
              pattern="[A-Za-z0-9-]{1,12}"
              required
            />
          </label>
          <label className="field">
            <span>Timezone</span>
            <input value={business.timezone} onChange={(event) => set("timezone", event.target.value)} required />
          </label>
          <label className="field span-two">
            <span>Default payment terms</span>
            <textarea
              rows={4}
              value={business.defaultPaymentTerms ?? ""}
              onChange={(event) => set("defaultPaymentTerms", event.target.value || null)}
            />
          </label>
        </div>
      </form>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Tax rates</h2>
            <p>Saved rates can be selected on invoice items.</p>
          </div>
        </div>
        <div className="tax-rate-list">
          {rates.map((rate) => (
            <div className="tax-rate-row" key={rate.id}>
              <div>
                <strong>{rate.name}</strong>
                <span>
                  {rate.rate}% {rate.isDefault ? "· Default" : ""}
                </span>
              </div>
              <button
                className="icon-button danger"
                aria-label={`Archive ${rate.name} tax rate`}
                title="Archive tax rate"
                onClick={() => void removeRate(rate.id)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <form className="inline-form" onSubmit={addRate}>
          <label className="field">
            <span>Rate name</span>
            <input
              value={newRate.name}
              onChange={(event) => setNewRate((current) => ({ ...current, name: event.target.value }))}
              required
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>Percentage</span>
            <input
              inputMode="decimal"
              value={newRate.rate}
              onChange={(event) => setNewRate((current) => ({ ...current, rate: event.target.value }))}
              required
              pattern="(?:0|[1-9]\d?)(?:\.\d{1,4})?|100(?:\.0{1,4})?"
            />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={newRate.isDefault}
              onChange={(event) => setNewRate((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            Default
          </label>
          <button className="button secondary" disabled={rateSubmitting}>
            <Plus size={17} />
            {rateSubmitting ? "Adding…" : "Add rate"}
          </button>
        </form>
      </section>
    </div>
  );
}
