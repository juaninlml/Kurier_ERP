import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto mt-20 flex max-w-md flex-col items-center text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">{t("No encontramos esta página")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("El documento pudo haberse eliminado o la dirección es incorrecta.")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("Ir al inicio")}</Link>
      </Button>
    </div>
  );
}
