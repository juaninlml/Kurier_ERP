import { CloudUpload, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { driveConfigured } from "@/lib/drive";
import { resyncDoc } from "@/app/actions/drive";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

/** "Ver en Drive" si el documento ya tiene copia; si no (o falló), botón para subirlo. Nada si Drive no está configurado. */
export async function DriveButton({ refKey, path }: { refKey: string; path: string }) {
  const t = await getT();
  if (!driveConfigured()) return null;
  const f = await prisma.driveFile.findUnique({ where: { refKey }, select: { link: true, error: true } });
  if (f?.link && !f.error)
    return (
      <a href={f.link} target="_blank" rel="noreferrer" className="btn-secondary" title={t("Copia en Google Drive")}>
        <ExternalLink className="size-4" /> <Tr>Ver en Drive</Tr>
      </a>
    );
  return (
    <Form action={resyncDoc.bind(null, refKey, path)}>
      <SubmitButton className="btn-secondary" pendingText={t("Subiendo…")}>
        <CloudUpload className="size-4" /> {f?.error ? t("Reintentar Drive") : t("Subir a Drive")}
      </SubmitButton>
    </Form>
  );
}
