import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autoriza la tablet como kiosco: el link sirve una vez y deja una cookie de larga duración. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const device = token ? await prisma.kioskDevice.findFirst({ where: { activationToken: token, active: true } }) : null;
  const url = new URL(req.url);
  if (!device) return NextResponse.redirect(new URL("/kiosco?error=activacion", url));
  const secret = randomBytes(32).toString("base64url");
  await prisma.kioskDevice.update({
    where: { id: device.id },
    data: { tokenHash: createHash("sha256").update(secret).digest("hex"), activationToken: "", lastSeenAt: new Date() },
  });
  const res = NextResponse.redirect(new URL("/kiosco", url));
  res.cookies.set("kurier_kiosk", secret, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 730, path: "/" });
  return res;
}
