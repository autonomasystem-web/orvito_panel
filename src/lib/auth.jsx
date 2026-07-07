import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    // Cambia la contraseña del usuario actual, verificando primero la actual.
    async changePassword(currentPassword, newPassword) {
      const email = session?.user?.email;
      if (!email) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const { error: e1 } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (e1) throw new Error("La contraseña actual no es correcta.");
      const { error: e2 } = await supabase.auth.updateUser({ password: newPassword });
      if (e2) throw new Error(e2.message || "No se pudo actualizar la contraseña.");
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
