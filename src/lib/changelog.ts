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
    id: "2026-11-28-e",
    kind: "improved",
    text: {
      es: {
        title: "Más fácil encontrar las cosas y ver lo pendiente",
        items: [
          "Menú reorganizado por tarea: Operación, Ventas, Facturación y cobro, Finanzas y Personal. Los grupos se pueden plegar. Insumos e Inventario ahora están como pestañas dentro de Órdenes diarias.",
          "Contadores en el menú: facturas vencidas en Cobranza, insumos por agotarse en Órdenes diarias, clientes sin facturar en Facturación semanal y pagos vencidos en Cuentas por pagar.",
          "Buscador general: presiona Ctrl+K (⌘K en Mac) o «Buscar…» para encontrar clientes, folios, guías, proveedores, empleados y secciones, o para crear una factura o capturar órdenes.",
          "Inicio tiene «Pendientes de hoy»: capturas del día, semana por facturar, promesas de pago, vencidos, pagos a proveedores, insumos por agotarse, envíos sin entregar y empleados sin checar, cada uno con su botón.",
          "Inicio separa lo facturado del mes de lo cobrado, y quien no ve finanzas ve paquetes y envíos del día.",
          "El promedio del mes en Órdenes diarias ya no cuenta las semanas anteriores a la primera captura.",
        ],
      },
      en: {
        title: "Easier to find things and see what's pending",
        items: [
          "Menu reorganized by task: Operations, Sales, Billing & collections, Finance and People. Groups can be collapsed. Supplies and Inventory are now tabs inside Daily orders.",
          "Counters in the menu: overdue invoices in Collections, supplies running low in Daily orders, clients not yet invoiced in Weekly billing and overdue payments in Accounts payable.",
          "Global search: press Ctrl+K (⌘K on Mac) or “Search…” to find clients, folios, tracking numbers, suppliers, employees and sections, or to create an invoice or enter orders.",
          "Home now has “Today's to-dos”: today's entries, week to invoice, payment promises, overdue amounts, supplier payments, low supplies, undelivered shipments and employees who haven't clocked in, each with its button.",
          "Home separates what was invoiced this month from what was collected, and people without finance access see today's packages and shipments.",
          "The monthly average in Daily orders no longer counts weeks before the first entry.",
        ],
      },
      zh: {
        title: "更容易找到内容、看到待办",
        items: [
          "菜单按任务重新分组：运营、销售、开票与收款、财务、人员。分组可以折叠。耗材和库存现在是“每日订单”里的标签页。",
          "菜单中显示计数：收款中的逾期发票、每日订单中即将用完的物料、每周开票中未开票的客户、应付账款中的逾期付款。",
          "全局搜索：按 Ctrl+K（Mac 为 ⌘K）或点“搜索…”，查找客户、单号、运单号、供应商、员工和页面，或直接新建发票、录入订单。",
          "首页新增“今日待办”：当日录入、待开票的一周、付款承诺、逾期款项、供应商付款、即将用完的物料、未送达的配送和未打卡的员工，每项都有直达按钮。",
          "首页将本月开票与本月收款分开显示；没有财务权限的人看到当日包裹和配送。",
          "每日订单的月平均值不再计入首次录入之前的周。",
        ],
      },
    },
  },
  {
    id: "2026-11-28-d",
    kind: "new",
    text: {
      es: {
        title: "Facturación semanal automática",
        items: [
          "Nueva pantalla Facturas → Facturación semanal: las facturas de servicio logístico de cada cliente se arman solas con sus órdenes diarias y el material de empaque de la semana.",
          "Emite de un clic todas las que están listas, o revisa una por una antes de crearla.",
          "Los clientes sin tarifa por paquete o con insumos sin precio quedan marcados para revisarlos.",
          "Cada lunes verás en Inicio un aviso cuando haya clientes de la semana anterior por facturar.",
        ],
      },
      en: {
        title: "Automatic weekly billing",
        items: [
          "New screen Invoices → Weekly billing: each client's logistics service invoice is built automatically from the week's daily orders and packing material.",
          "Issue all the ready ones in one click, or review each one before creating it.",
          "Clients without a per-package rate or with unpriced supplies are flagged for review.",
          "Every Monday you'll see a notice on Home when there are clients from the previous week to invoice.",
        ],
      },
      zh: {
        title: "每周自动开票",
        items: [
          "新增 发票 → 每周开票 页面：根据本周每日订单和包装材料，自动生成各客户的物流服务发票。",
          "一键开具所有已就绪的发票，或在创建前逐一核对。",
          "没有单件包裹费率或有耗材未定价的客户会被标出，需要核对。",
          "每周一，如有上周待开票的客户，首页会显示提醒。",
        ],
      },
    },
  },
  {
    id: "2026-11-28-c",
    kind: "new",
    text: {
      es: {
        title: "Inventario de insumos de empaque con alertas",
        items: [
          "Nueva pestaña Órdenes diarias → Inventario: existencia de cada bolsa y caja, consumo diario y para cuántos días alcanza.",
          "Registra las entradas del proveedor y haz conteos físicos; lo que se captura en Insumos de empaque se descuenta solo.",
          "Pon un mínimo por material y te avisamos en Inicio y en Insumos de empaque cuando esté por agotarse o se haya agotado.",
          "Para empezar, haz un conteo físico de cada material.",
        ],
      },
      en: {
        title: "Packing supplies inventory with alerts",
        items: [
          "New tab Daily orders → Inventory: stock of every bag and box, daily usage and how many days it will last.",
          "Record supplier receipts and do physical counts; what's entered in Packing supplies is deducted automatically.",
          "Set a minimum per material and you'll be warned on Home and in Packing supplies when it's running low or out.",
          "To get started, do a physical count of each material.",
        ],
      },
      zh: {
        title: "包装耗材库存及提醒",
        items: [
          "新增 每日订单 → 库存 标签页：每种袋子和箱子的库存、日用量以及可用天数。",
          "登记供应商入库并进行实物盘点；在“包装耗材”中录入的用量会自动扣减。",
          "为每种材料设置最低库存，即将用完或已用完时会在首页和“包装耗材”中提醒你。",
          "开始使用前，请先对每种材料做一次实物盘点。",
        ],
      },
    },
  },
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
