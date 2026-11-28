import { localeOf, type Lang } from "@/lib/i18n/core";

/**
 * Novedades del ERP. Cada vez que se publique una función nueva o una corrección que los usuarios noten,
 * agrega una entrada AL INICIO de la lista. Al entrar, cada usuario ve una sola vez las que aún no ha visto
 * (se guarda en User.lastSeenChangelog).
 *
 * - `id`: fecha de publicación "AAAA-MM-DD" (si hay dos el mismo día: "AAAA-MM-DD-b"). Debe ordenar
 *   alfabéticamente después de la entrada anterior; nunca cambies el id de una entrada ya publicada.
 * - Textos en español, inglés y chino, escritos para el usuario (qué puede hacer ahora), no técnicos.
 */
export type ChangelogEntry = {
  id: string;
  /** Tipo: función nueva, mejora o corrección. */
  kind: "new" | "improved" | "fixed";
  text: Record<Lang, { title: string; items: string[] }>;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-11-28-b",
    kind: "new",
    text: {
      es: {
        title: "Nueva sección de Cobranza",
        items: [
          "En Finanzas → Cobranza ves a los clientes con saldo, del más atrasado al más reciente, con sus facturas abiertas y días de atraso.",
          "Un clic abre WhatsApp o tu correo con el recordatorio de pago ya escrito (saldo, facturas vencidas y datos bancarios); también puedes descargar el estado de cuenta para adjuntarlo.",
          "Registra cada llamada, visita o mensaje y la fecha en que el cliente prometió pagar; las promesas incumplidas se marcan en rojo.",
          "Puedes registrar el pago de una factura ahí mismo.",
          "Ya no se ofrece pago contra entrega en los envíos de última milla: se quitó de las guías, la app de reparto y el rastreo.",
        ],
      },
      en: {
        title: "New Collections section",
        items: [
          "In Finance → Collections you see clients with a balance, most overdue first, with their open invoices and days late.",
          "One click opens WhatsApp or your email with the payment reminder already written (balance, overdue invoices and bank details); you can also download the account statement to attach it.",
          "Record each call, visit or message and the date the client promised to pay; broken promises are marked in red.",
          "You can record an invoice payment right there.",
          "Cash on delivery is no longer offered for last-mile shipments: it was removed from labels, the delivery app and tracking.",
        ],
      },
      zh: {
        title: "新增“催收”栏目",
        items: [
          "在 财务 → 催收 中可以看到有余额的客户，逾期最久的排在前面，并显示其未结发票和逾期天数。",
          "一键打开 WhatsApp 或邮箱，付款提醒已写好（余额、逾期发票和银行信息）；也可以下载对账单作为附件。",
          "记录每次电话、拜访或消息，以及客户承诺付款的日期；未兑现的承诺会以红色标出。",
          "可以直接在此登记发票付款。",
          "末端配送不再提供货到付款：已从运单、派送应用和物流追踪中移除。",
        ],
      },
    },
  },
  {
    id: "2026-11-28",
    kind: "new",
    text: {
      es: {
        title: "Chino simplificado y PDFs en tu idioma",
        items: [
          "Ya puedes usar el ERP en chino simplificado (简体中文): elígelo en tu menú de usuario o en Mi perfil.",
          "Todos los PDFs (facturas, cotizaciones, estados de cuenta, resúmenes de órdenes, nómina, guías y hojas de salida) salen en el idioma que elegiste.",
          "Corregido: el resumen semanal y mensual de órdenes ya no sale en español cuando usas el ERP en inglés.",
          "Desde ahora, esta ventana te avisará de cada novedad del sistema.",
        ],
      },
      en: {
        title: "Simplified Chinese and PDFs in your language",
        items: [
          "You can now use the ERP in Simplified Chinese (简体中文): pick it in your user menu or in My profile.",
          "All PDFs (invoices, quotes, account statements, order summaries, payroll, labels and goods exit sheets) come out in the language you chose.",
          "Fixed: the weekly and monthly orders summary no longer comes out in Spanish when you use the ERP in English.",
          "From now on, this window will let you know about every update to the system.",
        ],
      },
      zh: {
        title: "简体中文，PDF 按你的语言生成",
        items: [
          "现在可以使用简体中文版 ERP：在用户菜单或“我的资料”中选择。",
          "所有 PDF（发票、报价单、对账单、订单汇总、工资单、运单和出库单）都会以你选择的语言生成。",
          "已修复：使用英文界面时，每周和每月订单汇总不再以西班牙语生成。",
          "从现在起，系统的每次更新都会通过此窗口通知你。",
        ],
      },
    },
  },
];

/** Id de la novedad más reciente (lo que queda "visto" al cerrar la ventana o al crear un usuario). */
export const LATEST_CHANGELOG = CHANGELOG.reduce((a, e) => (e.id > a ? e.id : a), "");

/** Novedades que el usuario aún no ha visto, de la más reciente a la más antigua. */
export const unseenChangelog = (lastSeen: string) => CHANGELOG.filter((e) => e.id > lastSeen).sort((a, b) => b.id.localeCompare(a.id));

/** Novedades en el idioma del usuario, listas para la ventana o la página de novedades. */
export const localizeChangelog = (entries: ChangelogEntry[], lang: Lang) =>
  entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    ...e.text[lang],
    date: new Date(`${e.id.slice(0, 10)}T12:00:00Z`).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
  }));
