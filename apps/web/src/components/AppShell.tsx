import { FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { session, logout } = useAuth();
  const location = useLocation();
  const business = session.user.memberships[0]?.business;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <button
        className="mobile-menu-button"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="primary-sidebar"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </button>
      {open ? <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}
      <aside id="primary-sidebar" className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand-row">
          <Link className="brand-mark" to="/" aria-label="Invoice Forge dashboard">
            <img src="/favicon.svg" alt="" />
          </Link>
          <div>
            <strong>Invoice Forge</strong>
            <span>{business?.name ?? "Workspace"}</span>
          </div>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <NavLink className="button primary new-invoice" to="/invoices/new" onClick={() => setOpen(false)}>
          <Plus size={18} />
          New invoice
        </NavLink>
        <nav aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              {...(end ? { end: true } : {})}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-summary">
            <span className="avatar">{session.user.displayName.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{session.user.displayName}</strong>
              <span>{session.user.email}</span>
            </div>
          </div>
          <button className="icon-button" aria-label="Sign out" onClick={() => void logout()}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
