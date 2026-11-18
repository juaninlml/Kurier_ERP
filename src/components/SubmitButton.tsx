"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useFormPending } from "./Form";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Guardando…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending: nativePending } = useFormStatus();
  const pending = useFormPending() || nativePending;
  return (
    <button type="submit" className={cn(className)} disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}
