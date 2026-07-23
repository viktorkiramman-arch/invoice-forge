import { ArrowLeft, Calculator, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { calculateInvoice, InvoiceDomainError, type InvoiceCalculationResult } from "@invoice-forge/domain";
import { ErrorState, LoadingState } from "../components/States";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { Business, Customer, InvoiceDetail, TaxRate } from "../lib/types";

type DiscountChoice = "NONE" | "PERCENTAGE" | "FIXED";
interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: DiscountChoice;
  discountValue: string;
  taxRateId: string;
}
interface InvoiceFormValues {
  customerId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  purchaseOrderNumber: string;
  projectReference: string;
  notes: string;
  internalNotes: string;
  paymentTerms: string;
  invoiceDiscountType: DiscountChoice;
  invoiceDiscountValue: string;
  items: ItemForm[];
}

const emptyItem: ItemForm = {
  description: "",
  quantity: "1",
  unitPrice: "0.00",
  discountType: "NONE",
  discountValue: "",
  taxRateId: "",
};
const decimalPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const isZero = (value: string) => /^0(?:\.0+)?$/.test(value);

function formFromInvoice(invoice: InvoiceDetail): InvoiceFormValues {
  return {
    customerId: invoice.customerId ?? "",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    taxMode: invoice.taxMode,
    purchaseOrderNumber: invoice.purchaseOrderNumber ?? "",
    projectReference: invoice.projectReference ?? "",
    notes: invoice.notes ?? "",
    internalNotes: invoice.internalNotes ?? "",
    paymentTerms: invoice.paymentTerms ?? "",
    invoiceDiscountType: invoice.invoiceDiscountType ?? "NONE",
    invoiceDiscountValue: invoice.invoiceDiscountValue ?? "",
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountType: item.discountType ?? "NONE",
      discountValue: item.discountValue ?? "",
      taxRateId: item.taxRateId ?? "",
    })),
  };
}

export function InvoiceEditorPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    control,
    register,
    reset,
    getValues,
    trigger,
    formState: { errors, isDirty },
  } = useForm<InvoiceFormValues>({
    defaultValues: {
      customerId: "",
      issueDate: today(),
      dueDate: plusDays(today(), 14),
      currency: "USD",
      taxMode: "EXCLUSIVE",
      purchaseOrderNumber: "",
      projectReference: "",
      notes: "",
      internalNotes: "",
      paymentTerms: "",
      invoiceDiscountType: "NONE",
      invoiceDiscountValue: "",
      items: [{ ...emptyItem }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [businessData, customerData, rateData, invoiceData] = await Promise.all([
        api<Business>("/business"),
        api<Customer[]>("/customers"),
        api<TaxRate[]>("/tax-rates"),
        invoiceId ? api<InvoiceDetail>(`/invoices/${invoiceId}`) : Promise.resolve(null),
      ]);
      setBusiness(businessData);
      setCustomers(customerData);
      setRates(rateData);
      setInvoice(invoiceData);
      if (invoiceData) reset(formFromInvoice(invoiceData));
      else {
        const issueDate = today();
        reset({
          customerId: "",
          issueDate,
          dueDate: plusDays(issueDate, 14),
          currency: businessData.defaultCurrency,
          taxMode: businessData.defaultTaxMode,
          purchaseOrderNumber: "",
          projectReference: "",
          notes: "",
          internalNotes: "",
          paymentTerms: businessData.defaultPaymentTerms ?? "",
          invoiceDiscountType: "NONE",
          invoiceDiscountValue: "",
          items: [{ ...emptyItem, taxRateId: rateData.find((rate) => rate.isDefault)?.id ?? "" }],
        });
      }
      setPageError("");
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : "Unable to load invoice editor.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId, reset]);
  useEffect(() => {
    void load();
  }, [load]);

  const calculation = useMemo<{ result: InvoiceCalculationResult | null; error: string }>(() => {
    try {
      const items = (watched.items ?? []).map((item) => {
        const rate = rates.find((candidate) => candidate.id === item?.taxRateId);
        return {
          description: item?.description ?? "",
          quantity: item?.quantity || "0",
          unitPrice: item?.unitPrice || "0",
          discount:
            item?.discountType && item.discountType !== "NONE" && item.discountValue
              ? { type: item.discountType, value: item.discountValue }
              : null,
          tax: rate ? { name: rate.name, rate: rate.rate } : null,
        };
      });
      if (!items.length) return { result: null, error: "Add at least one line item." };
      return {
        result: calculateInvoice({
          currency: watched.currency ?? "USD",
          taxMode: watched.taxMode ?? "EXCLUSIVE",
          items,
          invoiceDiscount:
            watched.invoiceDiscountType && watched.invoiceDiscountType !== "NONE" && watched.invoiceDiscountValue
              ? { type: watched.invoiceDiscountType, value: watched.invoiceDiscountValue }
              : null,
        }),
        error: "",
      };
    } catch (cause) {
      return {
        result: null,
        error: cause instanceof InvoiceDomainError ? cause.message : "Totals cannot be calculated.",
      };
    }
  }, [watched, rates]);

  const payload = (values: InvoiceFormValues) => ({
    customerId: values.customerId || null,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    currency: values.currency,
    taxMode: values.taxMode,
    purchaseOrderNumber: values.purchaseOrderNumber || null,
    projectReference: values.projectReference || null,
    notes: values.notes || null,
    internalNotes: values.internalNotes || null,
    paymentTerms: values.paymentTerms || null,
    invoiceDiscount:
      values.invoiceDiscountType !== "NONE" && values.invoiceDiscountValue
        ? { type: values.invoiceDiscountType, value: values.invoiceDiscountValue }
        : null,
    items: values.items.map((item) => {
      const rate = rates.find((candidate) => candidate.id === item.taxRateId);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount:
          item.discountType !== "NONE" && item.discountValue
            ? { type: item.discountType, value: item.discountValue }
            : null,
        tax: rate ? { name: rate.name, rate: rate.rate, taxRateId: rate.id } : null,
      };
    }),
  });

  const save = async (values: InvoiceFormValues, showNotice = true): Promise<InvoiceDetail> => {
    if (!calculation.result) {
      setSaveError(calculation.error);
      throw new Error(calculation.error);
    }
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const result = invoice
        ? await api<InvoiceDetail>(`/invoices/${invoice.id}`, {
            method: "PATCH",
            body: JSON.stringify({ ...payload(values), version: invoice.version }),
          })
        : await api<InvoiceDetail>("/invoices", { method: "POST", body: JSON.stringify(payload(values)) });
      setInvoice(result);
      reset(values);
      if (showNotice) setNotice("Draft saved.");
      if (!invoice) navigate(`/invoices/${result.id}/edit`, { replace: true });
      return result;
    } catch (cause) {
      const message =
        cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Unable to save invoice.";
      setSaveError(message);
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    const valid = await trigger();
    if (!valid) return;
    if (!calculation.result) {
      setSaveError(calculation.error);
      return;
    }
    await save(getValues()).catch(() => undefined);
  };

  const finalize = async () => {
    const valid = await trigger();
    if (!valid || !getValues().customerId) {
      setSaveError("Select a customer and complete all required fields before finalizing.");
      return;
    }
    if (!calculation.result) {
      setSaveError(calculation.error);
      return;
    }
    try {
      const saved = await save(getValues(), false);
      const finalInvoice = await api<InvoiceDetail>(`/invoices/${saved.id}/finalize`, {
        method: "POST",
        body: JSON.stringify({ version: saved.version }),
      });
      navigate(`/invoices/${finalInvoice.id}`);
    } catch {
      /* Save error is already displayed. */
    }
  };

  if (loading) return <LoadingState label="Loading invoice editor" />;
  if (pageError || !business)
    return <ErrorState message={pageError || "Business settings are unavailable."} onRetry={() => void load()} />;

  return (
    <div className="page-stack invoice-editor-page">
      <header className="editor-header">
        <div>
          <Link className="back-link" to={invoice ? `/invoices/${invoice.id}` : "/invoices"}>
            <ArrowLeft size={17} />
            {invoice ? "Invoice details" : "Invoices"}
          </Link>
          <h1>{invoice ? `Edit ${invoice.number ?? "draft"}` : "New invoice"}</h1>
          <p>
            {isDirty ? "Unsaved changes" : invoice ? "All changes saved" : "Complete the invoice and save a draft."}
          </p>
        </div>
        <div className="header-actions">
          <button className="button secondary" type="button" disabled={saving} onClick={() => void saveDraft()}>
            <Save size={17} />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button className="button primary" type="button" disabled={saving} onClick={() => void finalize()}>
            Finalize invoice
          </button>
        </div>
      </header>
      {saveError ? (
        <div className="alert error" role="alert">
          {saveError}
        </div>
      ) : null}
      {notice ? (
        <div className="alert success" role="status">
          {notice}
        </div>
      ) : null}

      <div className="editor-layout">
        <form className="editor-form" onSubmit={(event) => event.preventDefault()}>
          <section className="card form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Customer and dates</h2>
              </div>
            </div>
            <div className="form-grid two">
              <div className="field span-two">
                <label htmlFor="invoice-customer">Customer</label>
                <select id="invoice-customer" {...register("customerId")}>
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName ?? customer.name}
                    </option>
                  ))}
                </select>
                <Link className="field-link" to="/customers">
                  Manage customers
                </Link>
              </div>
              <label className="field">
                <span>Issue date</span>
                <input type="date" {...register("issueDate", { required: "Issue date is required." })} />
              </label>
              <label className="field">
                <span>Due date</span>
                <input
                  type="date"
                  {...register("dueDate", {
                    required: "Due date is required.",
                    validate: (value) => value >= getValues().issueDate || "Due date cannot be before issue date.",
                  })}
                />
                {errors.dueDate ? <small className="field-error">{errors.dueDate.message}</small> : null}
              </label>
              <label className="field">
                <span>Currency</span>
                <select {...register("currency")}>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>JPY</option>
                  <option>KWD</option>
                </select>
              </label>
              <label className="field">
                <span>Tax mode</span>
                <select {...register("taxMode")}>
                  <option value="EXCLUSIVE">Tax added to prices</option>
                  <option value="INCLUSIVE">Tax included in prices</option>
                </select>
              </label>
              <label className="field">
                <span>
                  Project reference <small>Optional</small>
                </span>
                <input {...register("projectReference")} />
              </label>
              <label className="field">
                <span>
                  Purchase order <small>Optional</small>
                </span>
                <input {...register("purchaseOrderNumber")} />
              </label>
            </div>
          </section>

          <section className="card form-section line-items-section">
            <div className="section-heading">
              <div>
                <span className="section-number">02</span>
                <h2>Line items</h2>
              </div>
              <button
                type="button"
                className="button secondary small"
                onClick={() => append({ ...emptyItem, taxRateId: rates.find((rate) => rate.isDefault)?.id ?? "" })}
              >
                <Plus size={16} />
                Add item
              </button>
            </div>
            <div className="line-item-list">
              {fields.map((field, index) => (
                <div className="line-item-card" key={field.id}>
                  <div className="line-item-index">
                    <GripVertical size={17} aria-hidden="true" />
                    <span>Item {index + 1}</span>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="line-item-fields">
                    <label className="field item-description">
                      <span>Description</span>
                      <input
                        {...register(`items.${index}.description`, { required: "Description is required." })}
                        placeholder="Service or product"
                        maxLength={1000}
                        aria-invalid={Boolean(errors.items?.[index]?.description)}
                      />
                      {errors.items?.[index]?.description ? (
                        <small className="field-error">{errors.items[index]?.description?.message}</small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>Quantity</span>
                      <input
                        inputMode="decimal"
                        {...register(`items.${index}.quantity`, {
                          required: "Quantity is required.",
                          pattern: { value: decimalPattern, message: "Use up to 15 whole digits and 4 decimals." },
                          validate: (value) => !isZero(value) || "Must be greater than zero.",
                        })}
                        aria-invalid={Boolean(errors.items?.[index]?.quantity)}
                      />
                      {errors.items?.[index]?.quantity ? (
                        <small className="field-error">{errors.items[index]?.quantity?.message}</small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>Unit price</span>
                      <input
                        inputMode="decimal"
                        {...register(`items.${index}.unitPrice`, {
                          required: "Unit price is required.",
                          pattern: { value: decimalPattern, message: "Use up to 15 whole digits and 4 decimals." },
                        })}
                        aria-invalid={Boolean(errors.items?.[index]?.unitPrice)}
                      />
                      {errors.items?.[index]?.unitPrice ? (
                        <small className="field-error">{errors.items[index]?.unitPrice?.message}</small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>Discount</span>
                      <select {...register(`items.${index}.discountType`)}>
                        <option value="NONE">No discount</option>
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FIXED">Fixed amount</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Discount value</span>
                      <input
                        inputMode="decimal"
                        disabled={
                          !watched.items?.[index]?.discountType || watched.items[index]?.discountType === "NONE"
                        }
                        {...register(`items.${index}.discountValue`, {
                          validate: (value) =>
                            watched.items?.[index]?.discountType === "NONE" ||
                            decimalPattern.test(value) ||
                            "Enter a valid discount.",
                        })}
                        aria-invalid={Boolean(errors.items?.[index]?.discountValue)}
                      />
                      {errors.items?.[index]?.discountValue ? (
                        <small className="field-error">{errors.items[index]?.discountValue?.message}</small>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>Tax rate</span>
                      <select {...register(`items.${index}.taxRateId`)}>
                        <option value="">No tax</option>
                        {rates.map((rate) => (
                          <option key={rate.id} value={rate.id}>
                            {rate.name} · {rate.rate}%
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="line-total">
                      <span>Line total</span>
                      <strong>
                        {calculation.result?.items[index]
                          ? formatMoney(calculation.result.items[index]!.lineTotal, watched.currency ?? "USD")
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card form-section">
            <div className="section-heading">
              <div>
                <span className="section-number">03</span>
                <h2>Discounts and terms</h2>
              </div>
            </div>
            <div className="form-grid two">
              <label className="field">
                <span>Invoice discount</span>
                <select {...register("invoiceDiscountType")}>
                  <option value="NONE">No discount</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </label>
              <label className="field">
                <span>Discount value</span>
                <input
                  inputMode="decimal"
                  disabled={!watched.invoiceDiscountType || watched.invoiceDiscountType === "NONE"}
                  {...register("invoiceDiscountValue", {
                    validate: (value) =>
                      watched.invoiceDiscountType === "NONE" || decimalPattern.test(value) || "Enter a valid discount.",
                  })}
                  aria-invalid={Boolean(errors.invoiceDiscountValue)}
                />
                {errors.invoiceDiscountValue ? (
                  <small className="field-error">{errors.invoiceDiscountValue.message}</small>
                ) : null}
              </label>
              <label className="field span-two">
                <span>
                  Customer notes <small>Shown on PDF</small>
                </span>
                <textarea rows={4} {...register("notes")} />
              </label>
              <label className="field span-two">
                <span>Payment terms</span>
                <textarea rows={4} {...register("paymentTerms")} />
              </label>
              <label className="field span-two">
                <span>
                  Internal notes <small>Never shown to the customer</small>
                </span>
                <textarea rows={3} {...register("internalNotes")} />
              </label>
            </div>
          </section>
        </form>

        <aside className="totals-panel card">
          <div className="totals-heading">
            <Calculator size={20} />
            <div>
              <h2>Invoice total</h2>
              <p>{watched.taxMode === "INCLUSIVE" ? "Taxes included" : "Taxes added"}</p>
            </div>
          </div>
          {calculation.result ? (
            <dl className="totals-list">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(calculation.result.itemsSubtotal, calculation.result.currency)}</dd>
              </div>
              {!isZero(calculation.result.lineDiscountTotal) ? (
                <div>
                  <dt>Line discounts</dt>
                  <dd>−{formatMoney(calculation.result.lineDiscountTotal, calculation.result.currency)}</dd>
                </div>
              ) : null}
              {!isZero(calculation.result.invoiceDiscountTotal) ? (
                <div>
                  <dt>Invoice discount</dt>
                  <dd>−{formatMoney(calculation.result.invoiceDiscountTotal, calculation.result.currency)}</dd>
                </div>
              ) : null}
              {calculation.result.taxBreakdown.map((tax) => (
                <div key={`${tax.name}-${tax.rate}`}>
                  <dt>
                    {tax.name} {tax.rate}%
                  </dt>
                  <dd>{formatMoney(tax.amount, calculation.result!.currency)}</dd>
                </div>
              ))}
              <div className="grand-total">
                <dt>Total</dt>
                <dd>{formatMoney(calculation.result.grandTotal, calculation.result.currency)}</dd>
              </div>
            </dl>
          ) : (
            <div className="calculation-error" role="alert">
              {calculation.error}
            </div>
          )}
          <div className="totals-note">
            <strong>Server verified</strong>
            <span>Final totals are recalculated by the API before saving and finalization.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
