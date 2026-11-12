export const services = [
  {
    id: "landing",
    title: "Лендинг",
    description: "Одна страница. Одна сильная идея.",
    unit: "блоков",
    singular: "блок",
    included: 5,
    rate: 30000,
    extra: 3500,
    days: 7,
    icon: "layout",
  },
  {
    id: "website",
    title: "Многостраничный сайт",
    description: "Больше о бренде, продукте и бизнесе.",
    unit: "страниц",
    singular: "страница",
    included: 5,
    rate: 65000,
    extra: 8000,
    days: 14,
    icon: "layers",
  },
  {
    id: "product",
    title: "Веб-приложение",
    description: "Сервисы, кабинеты и сложные системы.",
    unit: "экранов",
    singular: "экран",
    included: 5,
    rate: 80000,
    extra: 6500,
    days: 18,
    icon: "panel",
  },
  {
    id: "mobile",
    title: "Мобильное приложение",
    description: "Продуманный опыт в каждом касании.",
    unit: "экранов",
    singular: "экран",
    included: 5,
    rate: 70000,
    extra: 5500,
    days: 16,
    icon: "phone",
  },
];
export const addons = [
  {
    id: "adaptive",
    title: "Адаптивный дизайн",
    description: "Макеты для планшетов и смартфонов",
    rate: 12000,
    days: 3,
    icon: "responsive",
  },
  {
    id: "research",
    title: "UX-исследование",
    description: "Конкуренты, аудитория и пользовательские сценарии",
    rate: 15000,
    days: 4,
    icon: "search",
  },
  {
    id: "prototype",
    title: "Интерактивный прототип",
    description: "Кликабельные переходы и ключевые сценарии",
    rate: 8000,
    days: 2,
    icon: "pointer",
  },
  {
    id: "ui-kit",
    title: "UI-kit и компоненты",
    description: "Единая система для развития продукта",
    rate: 18000,
    days: 4,
    icon: "component",
  },
  {
    id: "identity",
    title: "Логотип и айдентика",
    description: "Знак, палитра и типографика бренда",
    rate: 25000,
    days: 7,
    icon: "pen",
  },
  {
    id: "handoff",
    title: "Сопровождение разработки",
    description: "Проверка вёрстки и консультации, до 5 часов",
    rate: 10000,
    days: 2,
    icon: "code",
  },
];
export const functions = [
  {
    id: "forms",
    title: "Формы и заявки",
    description: "Состояния полей, валидация и подтверждение",
    rate: 4000,
    days: 1,
  },
  {
    id: "account",
    title: "Личный кабинет",
    description: "Вход, профиль и настройки пользователя",
    rate: 12000,
    days: 3,
  },
  {
    id: "catalog",
    title: "Каталог и фильтры",
    description: "Карточки, поиск и навигация по каталогу",
    rate: 10000,
    days: 3,
  },
  {
    id: "checkout",
    title: "Корзина и оформление",
    description: "Сценарий покупки и статусы заказа",
    rate: 14000,
    days: 3,
  },
];
export const urgencies = [
  {
    id: "standard",
    title: "Стандарт",
    description: "В комфортном темпе",
    multiplier: 1,
    speed: 1,
  },
  {
    id: "fast",
    title: "Быстрее",
    description: "Приоритет в работе",
    multiplier: 1.25,
    speed: 0.75,
  },
  {
    id: "express",
    title: "Срочно",
    description: "Максимальный фокус",
    multiplier: 1.5,
    speed: 0.5,
  },
];
/** @type {import('../src/lib/types').Project} */
export const defaultProject = {
  name: "",
  client: "",
  service: "landing",
  quantity: 5,
  addons: ["adaptive"],
  functions: [],
  urgency: "standard",
  discount: 0,
  notes: "",
  rates: {},
};

/** @param {typeof defaultProject & {rates: Record<string, number>}} project */
export function calculate(project) {
  const service = services.find((s) => s.id === project.service) ?? services[0];
  const urgency =
    urgencies.find((u) => u.id === project.urgency) ?? urgencies[0];
  const rate = (id, fallback) => project.rates?.[id] ?? fallback;
  const extra = Math.max(0, project.quantity - service.included);
  const lines = [
    {
      id: service.id,
      title: service.title,
      description: `Концепция, структура и дизайн · до ${service.included} ${service.unit}`,
      quantity: 1,
      rate: rate(service.id, service.rate),
      amount: rate(service.id, service.rate),
    },
  ];
  if (extra)
    lines.push({
      id: "extra",
      title:
        service.unit === "блоков"
          ? "Дополнительные блоки"
          : service.unit === "страниц"
            ? "Дополнительные страницы"
            : "Дополнительные экраны",
      description: `Объём: ${project.quantity} ${service.unit}; базовый пакет: ${service.included}`,
      quantity: extra,
      rate: rate(`${service.id}-extra`, service.extra),
      amount: extra * rate(`${service.id}-extra`, service.extra),
    });
  let days =
    service.days + Math.ceil(extra * (service.id === "landing" ? 0.5 : 1.5));
  for (const item of [
    ...addons.filter((a) => project.addons.includes(a.id)),
    ...functions.filter((f) => project.functions.includes(f.id)),
  ]) {
    lines.push({
      id: item.id,
      title: item.title,
      description: item.description,
      quantity: 1,
      rate: rate(item.id, item.rate),
      amount: rate(item.id, item.rate),
    });
    days += item.days;
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const urgencyFee = Math.round(subtotal * (urgency.multiplier - 1));
  const discountAmount = Math.round(
    ((subtotal + urgencyFee) * project.discount) / 100,
  );
  const finalDays = Math.max(1, Math.ceil(days * urgency.speed));
  const unitForms =
    service.unit === "блоков"
      ? ["блок", "блока", "блоков"]
      : service.unit === "страниц"
        ? ["страница", "страницы", "страниц"]
        : ["экран", "экрана", "экранов"];
  return {
    service,
    urgency,
    lines,
    subtotal,
    urgencyFee,
    discountAmount,
    total: subtotal + urgencyFee - discountAmount,
    days: finalDays,
    scopeLabel: `${project.quantity} ${plural(project.quantity, unitForms)}`,
    daysLabel: `${finalDays} ${plural(finalDays, ["рабочий день", "рабочих дня", "рабочих дней"])}`,
  };
}
function plural(n, forms) {
  return forms[
    n % 100 >= 11 && n % 100 <= 14
      ? 2
      : n % 10 === 1
        ? 0
        : n % 10 >= 2 && n % 10 <= 4
          ? 1
          : 2
  ];
}
export const money = (value) =>
  new Intl.NumberFormat("ru-RU").format(value) + " ₽";
const clean = (value) =>
  String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/[|`*_<>#\\]/g, "")
    .trim();
/** @param {typeof defaultProject & {rates: Record<string, number>}} project */
export function estimateText(project, markdown = false, date = new Date()) {
  const result = calculate(project);
  const title = clean(project.name) || "Новый проект";
  const out = [
    markdown ? `# Смета: ${title}` : `СМЕТА: ${title}`,
    "",
    `CASH / ALX DSGN · ${date.toLocaleDateString("ru-RU")}`,
  ];
  if (project.client.trim()) out.push(`Клиент: ${clean(project.client)}`);
  out.push(
    `Проект: ${result.service.title} · ${result.scopeLabel}`,
    "",
    markdown ? "## Состав работ" : "СОСТАВ РАБОТ",
  );
  result.lines.forEach((line, index) =>
    out.push(
      `${index + 1}. ${line.title} — ${line.quantity} × ${money(line.rate)} = ${money(line.amount)}`,
      `   ${line.description}.`,
    ),
  );
  out.push(
    "",
    `Стоимость работ: ${money(result.subtotal)}`,
    `Срочность: ${result.urgency.title} (×${result.urgency.multiplier}) · +${money(result.urgencyFee)}`,
  );
  if (project.discount)
    out.push(`Скидка ${project.discount}%: −${money(result.discountAmount)}`);
  out.push(
    "",
    markdown
      ? `**Итого: ${money(result.total)}**`
      : `ИТОГО: ${money(result.total)}`,
    `Ориентировочный срок: ${result.daysLabel} после согласования брифа и получения материалов.`,
    "",
    markdown ? "## Что входит в работу" : "ЧТО ВХОДИТ В РАБОТУ",
    "Дизайн-макеты в Figma, 2 круга правок и передача исходников. Программирование и платные материалы не включены.",
  );
  if (project.notes.trim())
    out.push(
      "",
      markdown ? "## Примечания" : "ПРИМЕЧАНИЯ",
      project.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    );
  out.push(
    "",
    "Предварительная оценка. Итоговая стоимость и сроки фиксируются после согласования объёма работ.",
    "ALX DSGN · https://alxdesign.ru",
  );
  return out.join("\n");
}
