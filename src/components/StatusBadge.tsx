"use client";

import { STATUS_LABELS, STATUS_TONES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "./I18nProvider";

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", STATUS_TONES[status] ?? "bg-muted text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {t(STATUS_LABELS[status] ?? status)}
    </Badge>
  );
}
