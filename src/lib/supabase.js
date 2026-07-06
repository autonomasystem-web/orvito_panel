import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Aviso claro en consola si faltan las env (no revienta el bundle)
  console.error(
    "[Orvito Admin] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu .env."
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
