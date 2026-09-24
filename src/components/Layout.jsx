import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Grid, Folder, Percent, Chat, Sparkles, Logout, Key, Newspaper, Book, Calendar, Brain, Bars, ChevronLeft, ChevronRight, Sticker } from "./Icons.jsx";
import { cx } from "./ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import OrvitoStatus from "./OrvitoStatus.jsx";
import AlertasBanner from "./AlertasBanner.jsx";
import { LOGO_WHITE } from "../assets/brand.js";

const NAV = [
  { to: "/", label: "Dashboard", short: "Dashboard", icon: Grid, end: true },
  { to: "/materiales", label: "Materiales", short: "Materiales", icon: Folder },
  { to: "/promociones", label: "Promociones", short: "Promos", icon: Percent },
  { to: "/blogs", label: "Blogs", short: "Blogs", icon: Newspaper },
  { to: "/entregas", label: "Entregas", short: "Entregas", icon: Calendar },
  { to: "/documentos", label: "Conocimiento", short: "Docs", icon: Book },
  { to: "/temas", label: "Temas / Alcance", short: "Temas", icon: Brain, adminOnly: true },
  { to: "/stickers", label: "Stickers", short: "Stickers", icon: Sticker, adminOnly: true },
  { to: "/esfuerzos", label: "Adopción E1–E5", short: "Esfuerzos", icon: Bars, adminOnly: true },
  { to: "/conversaciones", label: "Conversaciones", short: "Chats", icon: Chat },
  { to: "/resumenes", label: "Resúmenes IA", short: "Resúmenes", icon: Sparkles },
];

function Logo({ compact }) {
  return (
    <div className="flex items-center gap-3">
      <img src={LOGO_WHITE} alt="ORVE" className="h-8 w-auto" />
      {!compact && (
        <span className="border-l border-white/20 pl-3 font-display text-sm font-semibold tracking-wide text-white/90">
          Orvito Admin
        </span>
      )}
    </div>
  );
}

function Burger({ open }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

export default function Layout({ children }) {
  const { signOut, user, isAdmin } = useAuth();
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Barra lateral plegable (solo escritorio). Se recuerda la preferencia: si alguien
  // trabaja siempre en Conversaciones querrá el ancho extra en cada visita.
  const [plegada, setPlegada] = useState(() => {
    try {
      return localStorage.getItem("orvito_menu_plegado") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("orvito_menu_plegado", plegada ? "1" : "0");
    } catch {
      /* modo privado o almacenamiento bloqueado: se queda solo para esta sesión */
    }
  }, [plegada]);
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar desktop (plegable: se encoge a solo íconos) */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-gradient-to-b from-brand-dark to-brand-darkest py-6 transition-[width] duration-300 ease-in-out md:flex",
          plegada ? "w-[76px] px-3" : "w-64 px-4"
        )}
      >
        {/* Tirador: vive en el borde, así que se ve igual plegada o desplegada */}
        <button
          onClick={() => setPlegada((v) => !v)}
          title={plegada ? "Mostrar menú" : "Ocultar menú"}
          aria-label={plegada ? "Mostrar menú" : "Ocultar menú"}
          aria-expanded={!plegada}
          className="absolute -right-3 top-9 hidden h-6 w-6 items-center justify-center rounded-full bg-white text-brand-dark shadow-card ring-1 ring-black/5 transition-colors hover:bg-soft md:flex"
        >
          {plegada ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Plegada no cabe el logo a h-8 (mide 80 px de ancho y el riel deja 52):
            se pinta acotado por ancho en vez de por alto. */}
        <div className={cx(plegada ? "flex justify-center" : "px-2")}>
          {plegada ? (
            <img src={LOGO_WHITE} alt="ORVE" className="h-auto w-12" />
          ) : (
            <Logo />
          )}
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              // Plegada solo se ve el ícono, así que el nombre va en el tooltip nativo.
              title={plegada ? n.label : undefined}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
                  plegada ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-white/12 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <n.icon size={20} />
              {!plegada && n.label}
            </NavLink>
          ))}
        </nav>
        <div className={cx("mt-auto space-y-1", plegada ? "px-0" : "px-1")}>
          {user?.email && !plegada && (
            <p className="truncate px-2 pb-1 text-[11px] text-white/40" title={user.email}>
              {user.email}
            </p>
          )}
          <button
            onClick={() => setPwOpen(true)}
            title={plegada ? "Cambiar contraseña" : undefined}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
              plegada ? "justify-center px-0" : "px-2"
            )}
          >
            <Key size={20} /> {!plegada && "Cambiar contraseña"}
          </button>
          <button
            onClick={logout}
            title={plegada ? "Cerrar sesión" : undefined}
            className={cx(
              "flex w-full items-center gap-3 rounded-xl py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
              plegada ? "justify-center px-0" : "px-2"
            )}
          >
            <Logout size={20} /> {!plegada && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* Top bar móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-brand-dark to-brand-darkest px-4 py-3.5 md:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          className="-ml-1 p-1 text-white"
          aria-label="Abrir menú"
        >
          <Burger />
        </button>
        <Logo compact />
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

      {/* Drawer móvil (menú completo) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col bg-gradient-to-b from-brand-dark to-brand-darkest px-4 py-6 shadow-modal anim-reveal">
            <div className="flex items-center justify-between px-1">
              <Logo />
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 text-white/80"
                aria-label="Cerrar menú"
              >
                <Burger open />
              </button>
            </div>
            <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
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
            <div className="mt-3 space-y-1 border-t border-white/10 px-1 pt-3">
              {user?.email && (
                <p className="truncate px-2 pb-1 text-[11px] text-white/40" title={user.email}>
                  {user.email}
                </p>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPwOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Key size={20} /> Cambiar contraseña
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Logout size={20} /> Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Contenido */}
      <main
        className={cx(
          "transition-[padding] duration-300 ease-in-out",
          plegada ? "md:pl-[76px]" : "md:pl-64"
        )}
      >
        {/* Plegada se sube el tope de ancho: si no, el contenido se queda igual de
            angosto y esconder el menú no sirve de nada en una pantalla grande. */}
        <div
          className={cx(
            "mx-auto px-4 pb-10 pt-5 md:px-8 md:pb-12 md:pt-8",
            plegada ? "max-w-[1700px]" : "max-w-6xl"
          )}
        >
          <AlertasBanner />
          <OrvitoStatus />
          {children}
        </div>
      </main>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 md:mb-6 md:gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-brand-dark md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted md:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
