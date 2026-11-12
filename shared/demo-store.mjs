import { z } from "zod";
import { calculate } from "./calculator.mjs";
import { projectSchema, ratesSchema } from "./project-schema.mjs";

const estimateSchema = z.object({
  id: z.string(),
  project: projectSchema,
  total: z.number(),
  created: z.iso.datetime(),
  updated: z.iso.datetime(),
});
const listSchema = z.array(estimateSchema).max(200);
const estimatesKey = "cash-demo-estimates-v1";
const ratesKey = "cash-demo-rates-v1";

/** Browser-only demo persistence. No credentials or network requests. */
export function createDemoApi(
  storage,
  makeId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
) {
  function read(key, schema, fallback) {
    const value = storage.getItem(key);
    if (value === null) return fallback;
    const parsed = schema.safeParse(JSON.parse(value));
    if (!parsed.success)
      throw new Error(
        "Сохранённые данные демо повреждены. Проверьте хранилище браузера.",
      );
    return parsed.data;
  }
  function write(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      throw new Error(
        "Не удалось сохранить данные. Разрешите хранение в браузере или скачайте смету в Markdown.",
      );
    }
  }
  return async function demoApi(url, options = {}) {
    const method = options.method ?? "GET";
    if (url === "/auth/me" && method === "GET")
      return {
        user: {
          id: -1,
          name: "Демо",
          email: "Данные хранятся в этом браузере",
        },
      };
    if (url === "/rates" && method === "GET")
      return { rates: read(ratesKey, ratesSchema, {}) };
    if (url === "/rates" && method === "PUT") {
      const rates = ratesSchema.parse(options.body.rates);
      write(ratesKey, rates);
      return { rates };
    }
    if (url === "/estimates" && method === "GET")
      return {
        estimates: read(estimatesKey, listSchema, []).sort((a, b) =>
          b.updated.localeCompare(a.updated),
        ),
      };
    if (url === "/estimates" && method === "POST") {
      const project = projectSchema.parse(options.body.project);
      const list = read(estimatesKey, listSchema, []);
      if (list.length >= 200)
        throw new Error(
          "В демо сохранено 200 смет. Скачайте нужные документы в Markdown.",
        );
      const date = now();
      const estimate = {
        id: makeId(),
        project,
        total: calculate(project).total,
        created: date,
        updated: date,
      };
      write(estimatesKey, [...list, estimate]);
      return { estimate };
    }
    if (/^\/estimates\/[^/]+$/.test(url) && method === "PUT") {
      const list = read(estimatesKey, listSchema, []),
        id = url.slice("/estimates/".length);
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Смета не найдена в этом браузере.");
      const project = projectSchema.parse(options.body.project);
      list[index] = {
        ...list[index],
        project,
        total: calculate(project).total,
        updated: now(),
      };
      write(estimatesKey, list);
      return { ok: true };
    }
    throw new Error("Эта функция доступна в серверной версии CASH.");
  };
}
