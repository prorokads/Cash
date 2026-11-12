import { createDemoApi } from "../../shared/demo-store.mjs";
export const isDemo = import.meta.env.VITE_DEMO === "true";
let browserApi: ReturnType<typeof createDemoApi> | undefined;

export async function api<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  if (isDemo) {
    browserApi ??= createDemoApi(window.localStorage);
    return (await browserApi(url, options)) as T;
  }
  let response: Response;
  try {
    response = await fetch(`/api${url}`, {
      method: options?.method ?? "GET",
      credentials: "same-origin",
      headers: options?.body
        ? { "Content-Type": "application/json" }
        : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Сервер недоступен. Проверьте, что приложение запущено.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error ?? "Не удалось выполнить запрос.");
  return data;
}
