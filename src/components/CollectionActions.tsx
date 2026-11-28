"use client";

import { useState, useTransition } from "react";
import { FileDown, Mail, MessageCircle, NotebookPen, Trash2, X } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { NumberField } from "./NumberField";
import { useT } from "./I18nProvider";
import { addCollectionNote, deleteCollectionNote, logReminder } from "@/app/actions/collections";
import { CONTACT_KINDS, CONTACT_LABEL } from "@/lib/collection-kinds";
import { cn } from "@/lib/utils";

/**
 * Acciones de cobranza de un cliente: recordatorio por WhatsApp o correo (con el mensaje ya redactado; al abrirlo
 * queda anotado en el historial), estado de cuenta en PDF y registro de un seguimiento con promesa de pago.
 */
export function CollectionActions({
  clientId,
  waUrl,
  mailUrl,
  pdfHref,
  canEdit,
  today,
}: {
  clientId: number;
  /** null = el cliente no tiene teléfono / correo capturado. */
  waUrl: string | null;
  mailUrl: string | null;
  pdfHref: string;
  canEdit: boolean;
  today: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const log = (channel: "WHATSAPP" | "CORREO") => canEdit && start(async () => void (await logReminder(clientId, channel)));
  const disabled = "pointer-events-none opacity-45";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <a
          href={waUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          onClick={() => log("WHATSAPP")}
          aria-disabled={!waUrl}
          title={waUrl ? t("Abre WhatsApp con el recordatorio ya escrito") : t("El cliente no tiene teléfono capturado")}
          className={cn("btn-secondary", !waUrl && disabled)}
        >
          <MessageCircle className="size-4" /> {t("WhatsApp")}
        </a>
        <a
          href={mailUrl ?? undefined}
          onClick={() => log("CORREO")}
          aria-disabled={!mailUrl}
          title={mailUrl ? t("Abre tu correo con el recordatorio ya escrito") : t("El cliente no tiene correo capturado")}
          className={cn("btn-secondary", !mailUrl && disabled)}
        >
          <Mail className="size-4" /> {t("Correo")}
        </a>
        <a href={pdfHref} target="_blank" rel="noreferrer" className="btn-secondary" title={t("Descárgalo y adjúntalo al mensaje")}>
          <FileDown className="size-4" /> {t("Estado de cuenta")}
        </a>
        {canEdit && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn("btn-secondary", open && "bg-muted")}>
            {open ? <X className="size-4" /> : <NotebookPen className="size-4" />} {t("Registrar seguimiento")}
          </button>
        )}
      </div>

      {open && (
        <Form
          action={async (fd) => {
            const r = await addCollectionNote(clientId, fd);
            if (!(r && typeof r === "object" && "error" in r)) setOpen(false);
            return r;
          }}
          className="mt-3 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[10rem_1fr]"
        >
          <label className="block">
            <span className="label">{t("Tipo")}</span>
            <select name="kind" defaultValue="LLAMADA" className="input">
              {CONTACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(CONTACT_LABEL[k])}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{t("¿Qué pasó?")}</span>
            <input name="note" maxLength={1000} className="input" placeholder={t("Ej. contestó Ana, paga el viernes por transferencia")} />
          </label>
          <label className="block">
            <span className="label">{t("Prometió pagar el")}</span>
            <input name="promiseDate" type="date" min={today} className="input" />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-40 flex-1">
              <span className="label">{t("Monto prometido (MXN, opcional)")}</span>
              <NumberField name="promiseAmount" className="input text-right tabular-nums" placeholder="$0.00" />
            </label>
            <SubmitButton className="btn-primary" pendingText={t("Guardando…")}>
              {t("Guardar seguimiento")}
            </SubmitButton>
          </div>
        </Form>
      )}
    </div>
  );
}

/** Botón para borrar un seguimiento capturado por error. */
export function DeleteCollectionNote({ id }: { id: number }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm(t("¿Borrar este seguimiento?")) && start(async () => void (await deleteCollectionNote(id)))}
      aria-label={t("Borrar seguimiento")}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
