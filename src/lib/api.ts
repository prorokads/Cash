export async function api<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
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
