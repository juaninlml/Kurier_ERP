type PartyQuote = {
  client?: { name: string; legalName: string; rfc: string } | null;
  prospectName: string;
  prospectLegalName: string;
  prospectRfc: string;
};

/** A quién va dirigida la cotización: el cliente (si ya existe) o el prospecto. */
export function quoteParty(q: PartyQuote) {
  if (q.client) return { name: q.client.name, legalName: q.client.legalName, rfc: q.client.rfc, isProspect: false };
  return { name: q.prospectName || "Prospecto", legalName: q.prospectLegalName, rfc: q.prospectRfc, isProspect: true };
}
