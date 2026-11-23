"use client";

import { useRef } from "react";
import { PencilLine, X } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { useT } from "./I18nProvider";

type Dest = Record<"destName" | "destCompany" | "destEmail" | "destPhone" | "destStreet" | "destNumber" | "destColony" | "destCity" | "destState" | "destZip" | "destRef", string>;

const FIELDS: [keyof Dest, string, { required?: boolean; type?: string }?][] = [
  ["destName", "Nombre", { required: true }],
  ["destCompany", "Empresa"],
  ["destEmail", "Email", { type: "email" }],
  ["destPhone", "Teléfono", { required: true, type: "tel" }],
  ["destStreet", "Calle", { required: true }],
  ["destNumber", "Número"],
  ["destColony", "Colonia"],
  ["destCity", "Ciudad"],
  ["destState", "Estado"],
  ["destZip", "CP", { required: true }],
  ["destRef", "Referencia"],
];

/** Corregir destinatario: solo se guardan los campos que cambian y queda en la bitácora. */
export function RecipientDialog({ action, value }: { action: (fd: FormData) => Promise<unknown>; value: Dest }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="btn-secondary h-8 text-xs">
        <PencilLine className="size-3.5" /> {t("Corregir destinatario")}
      </button>
      <dialog ref={dialog} onClick={(e) => e.target === dialog.current && close()} className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/50">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-lg font-semibold">{t("Corregir destinatario")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Solo se guardan los campos que cambies. El CP manda en la cotización de la guía — para MX son 5 dígitos. El cambio queda en la bitácora.")}</p>
          </div>
          <button type="button" onClick={close} aria-label={t("Cerrar")} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <Form
          action={async (fd) => {
            const r = await action(fd);
            if (!(r && typeof r === "object" && "error" in r)) close();
            return r;
          }}
          className="grid gap-3 p-5 sm:grid-cols-2"
        >
          {FIELDS.map(([k, label, o]) => (
            <label key={k} className="block">
              <span className="label">{t(label)}</span>
              <input name={k} defaultValue={value[k]} required={o?.required} type={o?.type ?? "text"} inputMode={k === "destZip" ? "numeric" : undefined} maxLength={k === "destZip" ? 5 : undefined} className="input" />
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={close} className="btn-secondary">
              {t("Cancelar")}
            </button>
            <SubmitButton className="btn-kurier" pendingText={t("Guardando…")}>
              {t("Guardar cambios")}
            </SubmitButton>
          </div>
        </Form>
      </dialog>
    </>
  );
}
