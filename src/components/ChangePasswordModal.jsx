import { useState } from "react";
import { Modal, Button, Field, useToast, inputCls, cx } from "./ui.jsx";
import { Eye, EyeOff } from "./Icons.jsx";
import { useAuth } from "../lib/auth.jsx";

const MIN = 6;

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={cx(inputCls, "pr-10")}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-ink"
        aria-label={show ? "Ocultar" : "Mostrar"}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function ChangePasswordModal({ open, onClose }) {
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setActual("");
    setNueva("");
    setConfirma("");
    setTouched(false);
    setSaving(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const errNueva = touched && nueva.length < MIN ? `Mínimo ${MIN} caracteres.` : "";
  const errConfirma = touched && confirma && confirma !== nueva ? "No coincide con la nueva contraseña." : "";
  const errIgual = touched && nueva && actual && nueva === actual ? "La nueva debe ser distinta a la actual." : "";
  const valid =
    actual && nueva.length >= MIN && confirma === nueva && nueva !== actual;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await changePassword(actual, nueva);
      toast.success("Contraseña actualizada.");
      close();
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Cambiar contraseña"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Cambiando la contraseña de{" "}
        <b className="text-ink">{user?.email || "tu cuenta"}</b>.
      </p>

      <Field label="Contraseña actual">
        <PasswordInput
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          placeholder="Tu contraseña actual"
        />
      </Field>

      <Field label="Nueva contraseña" hint={errNueva || errIgual} hintTone="amber">
        <PasswordInput
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder={`Mínimo ${MIN} caracteres`}
        />
      </Field>

      <Field label="Confirmar nueva contraseña" hint={errConfirma} hintTone="amber">
        <PasswordInput
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          placeholder="Repite la nueva contraseña"
        />
      </Field>
    </Modal>
  );
}
