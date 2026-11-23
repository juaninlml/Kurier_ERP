"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useFormPending } from "./Form";
import { cn } from "@/lib/utils";
import { useT } from "./I18nProvider";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Guardando…",
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending: nativePending } = useFormStatus();
  const pending = useFormPending() || nativePending;
  const t = useT();
  return (
    <button type="submit" className={cn(className)} disabled={pending || disabled} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? t(pendingText) : typeof children === "string" ? t(children) : children}
    </button>
  );
}
