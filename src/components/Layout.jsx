import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Grid, Folder, Percent, Chat, Sparkles, Logout, Leaf, Key } from "./Icons.jsx";
import { cx } from "./ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";

const NAV = [
  { to: "/", label: "Dashboard", short: "Dashboard", icon: Grid, end: true },
  { to: "/materiales", label: "Materiales", short: "Materiales", icon: Folder },
  { to: "/promociones", label: "Promociones", short: "Promos", icon: Percent },
  { to: "/conversaciones", label: "Conversaciones", short: "Chats", icon: Chat },
  { to: "/resumenes", label: "Resúmenes IA", short: "Resúmenes", icon: Sparkles },
];

function Logo({ compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-leaf/15 text-brand-leaf">
        <Leaf size={20} />
      </span>
      {!compact && <span className="font-display text-lg font-bold text-white">Orvito Admin</span>}
    </div>
  );
}

export default function Layout({ children }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-gradient-to-b from-brand-dark to-brand-darkest px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 px-1">
          {user?.email && (
            <p className="truncate px-2 pb-1 text-[11px] text-white/40" title={user.email}>
              {user.email}
            </p>
          )}
          <button
            onClick={() => setPwOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Key size={20} /> Cambiar contraseña
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Logout size={20} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Top bar móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-brand-dark to-brand-darkest px-4 py-3.5 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPwOpen(true)}
            className="p-1 text-white/80"
            aria-label="Cambiar contraseña"
          >
            <Key size={22} />
          </button>
          <button onClick={logout} className="p-1 text-white/80" aria-label="Cerrar sesión">
            <Logout size={22} />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</div>
      </main>

      {/* Bottom nav móvil */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-line bg-white/95 px-1 py-2 shadow-modal backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cx(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
                isActive ? "text-brand-dark" : "text-muted2"
              )
            }
          >
            <n.icon size={20} />
            {n.short}
          </NavLink>
        ))}
      </nav>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-dark">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
