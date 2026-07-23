/* eslint-disable @next/next/no-img-element -- static public assets avoid a runtime image optimizer in the Worker */

const repositoryUrl = "https://github.com/viktorkiramman-arch/invoice-forge";

const capabilities = [
  {
    label: "Financial accuracy",
    title: "Decimal-safe by design",
    body: "Currency-aware rounding, proportional discount allocation, and server-authoritative tax calculations.",
  },
  {
    label: "Historical integrity",
    title: "Finalized means immutable",
    body: "Permanent business, customer, and calculation snapshots preserve exactly what was issued.",
  },
  {
    label: "Workspace security",
    title: "Tenant-scoped everywhere",
    body: "Authenticated sessions, server-side authorization, validated inputs, and business-scoped data access.",
  },
];

const workflow = [
  ["01", "Configure", "Set business details, invoice numbering, payment terms, and reusable tax rates."],
  ["02", "Create", "Build customer records and flexible invoices with discounts, taxes, and live totals."],
  ["03", "Finalize", "Reserve the permanent invoice number and lock an auditable financial snapshot."],
  ["04", "Track", "Search history, update payment status, duplicate corrections, and download polished PDFs."],
];

export default function Home() {
  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Invoice Forge home">
          <img src="/logo.svg" width="44" height="44" alt="" />
          <span>
            <strong>Invoice Forge</strong>
            <small>Open-source invoicing</small>
          </span>
        </a>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a className="button button-secondary" href={repositoryUrl}>
            GitHub repository
          </a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <span className="eyebrow">Production-style invoice platform</span>
          <h1>
            Precise invoices.
            <span> Clear payment history.</span>
          </h1>
          <p>
            A secure full-stack invoicing workspace with decimal-safe calculations, immutable finalization,
            transactional numbering, and polished server-generated PDFs.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={repositoryUrl}>
              View source on GitHub
            </a>
            <a className="button button-text" href="#run">
              Run it locally <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className="stack-list" aria-label="Technology stack">
            <li>React 19</li>
            <li>Fastify 5</li>
            <li>Prisma</li>
            <li>TypeScript</li>
            <li>Playwright</li>
          </ul>
        </div>

        <div className="hero-visual" aria-label="Invoice Forge dashboard preview">
          <div className="window-bar">
            <span />
            <span />
            <span />
            <small>invoice-forge / dashboard</small>
          </div>
          <img
            className="product-shot"
            src="/dashboard.jpg"
            width="1264"
            height="770"
            alt="Invoice Forge dashboard showing draft, outstanding, paid, and overdue invoice summaries"
          />
          <div className="verified-chip">
            <span aria-hidden="true">✓</span>
            Server-verified totals
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Project guarantees">
        <div className="shell trust-grid">
          <div>
            <strong>12</strong>
            <span>automated unit tests</span>
          </div>
          <div>
            <strong>Full lifecycle</strong>
            <span>Playwright verification</span>
          </div>
          <div>
            <strong>0</strong>
            <span>known production vulnerabilities</span>
          </div>
          <div>
            <strong>Responsive</strong>
            <span>desktop and mobile UI</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="features">
        <div className="section-heading">
          <span className="eyebrow">Built for correctness</span>
          <h2>Professional billing without spreadsheet risk.</h2>
          <p>Every layer reinforces accurate money, clear ownership, and reliable invoice history.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability, index) => (
            <article key={capability.title} className="capability-card">
              <span className="card-number">0{index + 1}</span>
              <small>{capability.label}</small>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-section">
        <div className="shell product-grid">
          <div className="product-copy">
            <span className="eyebrow">A focused workspace</span>
            <h2>Everything needed from draft to paid.</h2>
            <p>
              Configure a customer, build line items, preview exact totals, finalize the invoice, and track its
              lifecycle without leaving the application.
            </p>
            <ul className="check-list">
              <li>Inclusive and exclusive taxes</li>
              <li>Fixed and percentage discounts</li>
              <li>Draft preview and finalized PDF download</li>
              <li>Paid, overdue, cancelled, and void states</li>
              <li>Searchable audit history</li>
            </ul>
          </div>
          <div className="editor-frame">
            <img
              src="/editor.jpg"
              width="1264"
              height="710"
              alt="Invoice Forge editor with customer fields and a server-verified totals panel"
            />
          </div>
        </div>
      </section>

      <section className="section shell" id="workflow">
        <div className="section-heading workflow-heading">
          <div>
            <span className="eyebrow">Clear workflow</span>
            <h2>From setup to a permanent PDF.</h2>
          </div>
          <p>Simple interactions on the surface, strict financial and authorization rules underneath.</p>
        </div>
        <ol className="workflow-grid">
          {workflow.map(([number, title, body]) => (
            <li key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="run-section" id="run">
        <div className="shell run-grid">
          <div>
            <span className="eyebrow eyebrow-light">Run locally</span>
            <h2>Start with one verified setup flow.</h2>
            <p>
              The repository includes committed migrations, deterministic demo data, complete environment documentation,
              and exact validation commands.
            </p>
            <div className="demo-account">
              <span>Demo account</span>
              <code>demo@invoiceforge.local / demo1234</code>
            </div>
          </div>
          <pre aria-label="Local setup commands">
            <code>{`Copy-Item .env.example .env
npm ci
npm exec playwright install chromium
npm run setup
npm run dev`}</code>
          </pre>
        </div>
      </section>

      <footer className="footer shell">
        <div className="brand">
          <img src="/logo.svg" width="38" height="38" alt="" />
          <span>
            <strong>Invoice Forge</strong>
            <small>Built for accurate billing.</small>
          </span>
        </div>
        <p>
          Source available on{" "}
          <a href={repositoryUrl}>
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </p>
      </footer>
    </main>
  );
}
