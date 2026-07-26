import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, Input, useToast } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { LOGO_COLOR } from "../assets/brand.js";
import bgUrl from "../assets/orve-bg.webp";

function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(
        /invalid/i.test(err?.message || "")
          ? "Correo o contraseña incorrectos."
          : "No pudimos iniciar sesión. Intenta de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
      {/* fondo ORVE (webp ligero) con base de color para carga instantánea */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgUrl})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-canvas/60 to-canvas/90" aria-hidden />

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white/95 p-8 shadow-modal backdrop-blur-sm">
        <div className="flex flex-col items-center text-center">
          <img src={LOGO_COLOR} alt="ORVE — Inversión Inmobiliaria" className="h-14 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-brand-dark">Orvito Admin</h1>
          <p className="mt-1 text-sm text-muted">Panel del equipo ORVE</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Correo electrónico">
            <Input
              type="email"
              autoComplete="email"
              placeholder="tu@grupoorve.mx"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Contraseña">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "2.75rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted2 hover:text-ink"
                aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                <EyeIcon off={showPw} />
              </button>
            </div>
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
