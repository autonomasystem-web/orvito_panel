import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf } from "../components/Icons.jsx";
import { Button, Field, Input, useToast } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand-leaf">
            <Leaf size={28} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-brand-dark">Orvito Admin</h1>
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
      <p className="mt-6 text-xs text-muted2">Powered by Autónoma System</p>
    </div>
  );
}
