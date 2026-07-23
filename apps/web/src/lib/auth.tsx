import { createContext, useContext } from "react";
import type { UserSession } from "./types";

export interface AuthContextValue {
  session: UserSession;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth context is unavailable.");
  return value;
}
