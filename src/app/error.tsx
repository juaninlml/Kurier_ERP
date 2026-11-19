"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/I18nProvider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card>
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" />
          </div>
          <CardTitle>{t("No se pudo completar la operación")}</CardTitle>
          <CardDescription>{error.message ? t(error.message) : t("Ocurrió un error inesperado. Intenta de nuevo.")}</CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="gap-2">
          <Button variant="outline" onClick={() => history.back()}>{t("Regresar")}</Button>
          <Button onClick={reset}>{t("Reintentar")}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
