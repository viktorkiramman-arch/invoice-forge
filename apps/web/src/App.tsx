import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/States";
import { api } from "./lib/api";
import { AuthContext } from "./lib/auth";
import type { UserSession } from "./lib/types";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { InvoiceEditorPage } from "./pages/InvoiceEditorPage";
import { InvoiceListPage } from "./pages/InvoiceListPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await api<UserSession>("/auth/me"));
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading)
    return (
      <div className="full-screen-state">
        <LoadingState label="Opening Invoice Forge" />
      </div>
    );

  return (
    <BrowserRouter>
      {session ? (
        <AuthContext.Provider
          value={{
            session,
            logout: async () => {
              await api<void>("/auth/logout", { method: "POST" });
              setSession(null);
            },
          }}
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="invoices" element={<InvoiceListPage />} />
              <Route path="invoices/new" element={<InvoiceEditorPage />} />
              <Route path="invoices/:invoiceId/edit" element={<InvoiceEditorPage />} />
              <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthContext.Provider>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={refresh} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
