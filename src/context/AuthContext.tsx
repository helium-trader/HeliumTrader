"use client";

import {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

function makeInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "U";
  return trimmed
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const sessionUser = session?.user;
  const user: User | null = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name || sessionUser.email.split("@")[0],
        email: sessionUser.email,
        initials: makeInitials(sessionUser.name || sessionUser.email),
      }
    : null;

  const logout = useCallback(async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading: isPending, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
