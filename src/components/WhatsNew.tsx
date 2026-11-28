"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/I18nProvider";
import { markChangelogSeen } from "@/app/actions/account";

export type WhatsNewEntry = { id: string; kind: "new" | "improved" | "fixed"; title: string; items: string[]; date: string };

export const KIND_LABEL = { new: "Nuevo", improved: "Mejora", fixed: "Corrección" } as const;

/** Lista de novedades (la usan la ventana y la página /novedades). */
export function ChangelogList({ entries }: { entries: WhatsNewEntry[] }) {
  const t = useT();
  return (
    <ol className="space-y-5">
      {entries.map((e) => (
        <li key={e.id}>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant={e.kind === "fixed" ? "secondary" : "default"}>{t(KIND_LABEL[e.kind])}</Badge>
            <time className="text-xs text-muted-foreground" dateTime={e.id.slice(0, 10)}>
              {e.date}
            </time>
          </div>
          <h3 className="font-medium">{e.title}</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {e.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * Ventana de novedades: aparece una vez al entrar si hay cambios que el usuario no ha visto.
 * Al cerrarla quedan marcados como vistos en su cuenta (en cualquier equipo). No sale en el kiosco ni en reparto.
 */
export function WhatsNew({ entries }: { entries: WhatsNewEntry[] }) {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const [, start] = useTransition();
  if (!entries.length || path.startsWith("/kiosco") || path.startsWith("/reparto")) return null;

  const close = (next: boolean) => {
    if (next) return;
    setOpen(false);
    start(async () => void (await markChangelogSeen()));
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4.5" aria-hidden />
            </span>
            <div>
              <Dialog.Title className="font-semibold">{t("Novedades en Kurier ERP")}</Dialog.Title>
              <p className="text-xs text-muted-foreground">{t("Lo que cambió desde tu última visita")}</p>
            </div>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            <ChangelogList entries={entries} />
          </div>
          <div className="flex justify-end border-t px-5 py-3">
            <Dialog.Close asChild>
              <Button autoFocus>{t("Entendido")}</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
