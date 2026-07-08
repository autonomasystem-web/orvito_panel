import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from "react";
import { X, Check, Alert, Search as SearchIcon } from "./Icons.jsx";

export const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------------- Button ---------------- */
export function Button({ variant = "primary", size = "md", className, children, ...props }) {
  const variants = {
    primary: "bg-brand text-ink hover:brightness-95 disabled:opacity-50",
    outline: "bg-white text-ink border border-line hover:bg-softer disabled:opacity-50",
    ghost: "bg-transparent text-muted hover:bg-soft hover:text-ink",
    danger: "bg-danger text-white hover:brightness-95 disabled:opacity-50",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
    icon: "h-9 w-9",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-leaf/40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- Card ---------------- */
export const Card = forwardRef(function Card({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cx("rounded-2xl border border-line bg-white shadow-card", className)}
      {...props}
    >
      {children}
    </div>
  );
});

/* ---------------- Inputs ---------------- */
export function Field({ label, hint, hintTone = "muted", children }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-muted">{label}</span>}
      {children}
      {hint && (
        <span
          className={cx(
            "block text-xs",
            hintTone === "brand" ? "text-brand-green" : hintTone === "amber" ? "text-amber" : "text-muted2"
          )}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
export const inputCls =
  "w-full h-11 rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-muted2 focus:outline-none focus:ring-2 focus:ring-brand-leaf/40 focus:border-brand-leaf/40";
export function Input(props) {
  return <input className={inputCls} {...props} />;
}
export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cx(inputCls, "h-auto py-2.5 min-h-[96px] resize-y", className)}
      {...props}
    />
  );
}
export function SearchInput(props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2">
        <SearchIcon size={18} />
      </span>
      <input className={cx(inputCls, "pl-10")} {...props} />
    </div>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-leaf/40",
        checked ? "bg-brand-dark" : "bg-line"
      )}
    >
      <span
        className={cx(
          "h-6 w-6 shrink-0 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* ---------------- StatusChip ---------------- */
const CHIP = {
  activo: "bg-soft text-brand-dark",
  vigente: "bg-soft text-brand-dark",
  inactivo: "bg-line text-muted",
  inactiva: "bg-line text-muted",
  programada: "bg-brand-green/10 text-brand-green",
  expirada: "bg-line text-muted2",
};
const DOT = {
  activo: "bg-brand-leaf",
  vigente: "bg-brand-leaf",
  inactivo: "bg-muted2",
  inactiva: "bg-muted2",
  programada: "bg-brand-green",
  expirada: "bg-muted2",
};
export function StatusChip({ estado }) {
  const key = String(estado || "").toLowerCase();
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        CHIP[key] || CHIP.inactivo
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", DOT[key] || DOT.inactivo)} />
      {estado}
    </span>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }) {
  return <div className={cx("animate-pulse rounded-lg bg-line/70", className)} />;
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-soft text-brand-dark">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- ErrorState ---------------- */
export function ErrorState({ title, text, onRetry }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-danger/10 text-danger">
        <Alert size={22} />
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </Card>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-brand-darkest/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className={cx("relative my-8 w-full rounded-2xl bg-white p-6 shadow-modal", w)}>
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-brand-dark">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone, message) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => remove(id), 3800);
    },
    [remove]
  );
  const api = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-modal",
              t.tone === "success" ? "bg-brand-dark text-white" : "bg-danger text-white"
            )}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20">
              {t.tone === "success" ? <Check size={14} /> : <Alert size={14} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}
