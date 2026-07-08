import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, Input, useToast } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { LOGO_COLOR } from "../assets/brand.js";
import bgUrl from "../assets/orve-bg.webp";

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
