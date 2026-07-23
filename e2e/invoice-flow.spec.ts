import { expect, test } from "@playwright/test";

test("owner can complete the full invoice lifecycle", async ({ page }) => {
  test.setTimeout(120_000);

  const unique = Date.now();
  const email = `owner.${unique}@invoiceforge.test`;
  const password = "correct-horse-42";
  const businessName = `Forge Test Studio ${unique}`;
  const customerCompany = `Blue Harbor ${unique}`;

  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Jordan Lee");
  await page.getByLabel("Business name").fill(businessName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("No invoices yet. Create the first one to populate this dashboard.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Business settings" })).toBeVisible();
  await page.getByLabel("Billing email").fill("billing@forge-test.example");
  await page.getByLabel("Address line 1").fill("125 Test Avenue");
  await page.getByLabel("City").fill("Portland");
  await page.getByLabel("Region").fill("OR");
  await page.getByLabel("Postal code").fill("97205");
  await page.getByLabel("Country").fill("United States");
  await page.getByLabel("Invoice prefix").fill("QA");
  await page.getByLabel("Timezone").fill("UTC");
  await page.getByLabel("Default payment terms").fill("Payment due within 14 days.");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Business settings saved.")).toBeVisible();

  await page.getByLabel("Rate name").fill("City tax");
  await page.getByLabel("Percentage").fill("8.25");
  await page.getByRole("checkbox", { name: "Default" }).check();
  await page.getByRole("button", { name: "Add rate" }).click();
  await expect(page.getByText("Tax rate added.")).toBeVisible();
  await expect(page.getByText("City tax")).toBeVisible();

  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Contact name").fill("Taylor Morgan");
  await page.getByLabel("Company").fill(customerCompany);
  await page.getByLabel("Email").fill("accounts@blue-harbor.example");
  await page.getByLabel("City").fill("Seattle");
  await page.getByLabel("Country").fill("United States");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("heading", { name: customerCompany })).toBeVisible();

  let customerCard = page.getByRole("article").filter({ hasText: customerCompany });
  await customerCard.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Phone").fill("+1 555 010 4300");
  await page.getByRole("button", { name: "Save customer" }).click();
  customerCard = page.getByRole("article").filter({ hasText: customerCompany });
  await customerCard.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Phone")).toHaveValue("+1 555 010 4300");
  await page.getByRole("button", { name: "Cancel" }).click();

  customerCard = page.getByRole("article").filter({ hasText: customerCompany });
  await customerCard.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("heading", { name: customerCompany })).not.toBeVisible();
  await page.getByLabel("Show archived").check();
  await expect(page.getByRole("heading", { name: customerCompany })).toBeVisible();
  customerCard = page.getByRole("article").filter({ hasText: customerCompany });
  await customerCard.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("heading", { name: customerCompany })).not.toBeVisible();
  await page.getByLabel("Show archived").uncheck();
  await expect(page.getByRole("heading", { name: customerCompany })).toBeVisible();

  await page.getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByRole("heading", { name: "New invoice" })).toBeVisible();
  await page.getByLabel("Customer", { exact: true }).selectOption({ label: customerCompany });
  await page.getByLabel("Project reference").fill("Website accessibility review");
  await page.getByLabel("Description").fill("Accessibility audit and remediation");
  await page.getByLabel("Quantity").fill("2.5");
  await page.getByLabel("Unit price").fill("240");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit$/);
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByLabel("Project reference").fill("Website accessibility audit");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("link", { name: "Invoice details" }).click();
  await expect(page.locator('[aria-label="Status: Draft"]')).toBeVisible();

  const draftPreviewHref = await page.getByRole("link", { name: "Preview PDF" }).getAttribute("href");
  expect(draftPreviewHref).toBeTruthy();
  const draftPreview = await page.context().request.get(new URL(draftPreviewHref!, page.url()).href);
  expect(draftPreview.status()).toBe(200);
  expect(draftPreview.headers()["content-type"]).toContain("application/pdf");
  expect(draftPreview.headers()["content-disposition"]).toContain("inline");
  expect((await draftPreview.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Finalize invoice" }).click();
  await expect(page.locator('[aria-label="Status: Finalized"]')).toBeVisible({ timeout: 30_000 });
  const originalInvoiceUrl = page.url();
  const originalInvoiceNumber = (await page.getByRole("heading", { level: 1 }).textContent())?.trim();
  expect(originalInvoiceNumber).toMatch(/^QA-\d{4}-0001$/);

  const downloadHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  expect(downloadHref).toBeTruthy();
  const finalPdf = await page.context().request.get(new URL(downloadHref!, page.url()).href);
  expect(finalPdf.status()).toBe(200);
  expect(finalPdf.headers()["content-disposition"]).toContain("attachment");
  expect((await finalPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const originalInvoiceId = new URL(originalInvoiceUrl).pathname.split("/").at(-1);
  expect(originalInvoiceId).toBeTruthy();
  const immutableDelete = await page.context().request.delete(`/api/v1/invoices/${originalInvoiceId}`);
  expect(immutableDelete.status()).toBe(409);
  expect(await immutableDelete.json()).toMatchObject({ code: "NOT_EDITABLE" });

  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.locator('[aria-label="Status: Paid"]')).toBeVisible();
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit$/);
  await expect(page.getByLabel("Description")).toHaveValue("Accessibility audit and remediation");
  await page.getByRole("link", { name: "Invoice details" }).click();
  await page.getByRole("button", { name: "Cancel draft" }).click();
  await expect(page.locator('[aria-label="Status: Cancelled"]')).toBeVisible();

  await page.goto(originalInvoiceUrl);
  await expect(page.locator('[aria-label="Status: Paid"]')).toBeVisible();
  await page.getByRole("button", { name: "Void invoice" }).click();
  const voidDialog = page.getByRole("dialog", { name: "Void this invoice?" });
  await voidDialog.getByLabel("Reason").fill("Replaced after a billing correction");
  await voidDialog.getByRole("button", { name: "Void invoice", exact: true }).click();
  await expect(page.locator('[aria-label="Status: Void"]')).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Invoices" }).click();
  await page.getByLabel("Search invoices").fill(originalInvoiceNumber!);
  await page.getByLabel("Filter by status").selectOption("VOID");
  await expect(page.getByRole("link", { name: originalInvoiceNumber!, exact: true })).toBeVisible();
  await page.getByLabel("Sort invoices").selectOption("total");
  await expect(page.getByText("1 invoice")).toBeVisible();
});
