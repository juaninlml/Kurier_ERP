"use client";

import { useFormStatus } from "react-dom";
import { useFormPending } from "./Form";

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
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
