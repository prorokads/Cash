import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoApi } from "../shared/demo-store.mjs";
import { defaultProject, calculate } from "../shared/calculator.mjs";

test("Pages demo saves, reloads and updates estimates without a server", async () => {
  const data = new Map(),
    storage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
    };
  const api = createDemoApi(
    storage,
    () => "demo-1",
    () => "2026-11-12T18:00:00.000Z",
  );
  const project = { ...structuredClone(defaultProject), name: "Coffee" };
  assert.equal((await api("/auth/me")).user.name, "Демо");
  const { estimate } = await api("/estimates", {
    method: "POST",
    body: { project },
  });
  assert.equal(estimate.total, calculate(project).total);
  const reloaded = createDemoApi(storage);
  assert.equal((await reloaded("/estimates")).estimates.length, 1);
  await reloaded("/estimates/demo-1", {
    method: "PUT",
    body: { project: { ...project, quantity: 8 } },
  });
  assert.equal((await reloaded("/estimates")).estimates[0].total, 52500);
  await reloaded("/rates", { method: "PUT", body: { rates: { landing: 0 } } });
  assert.deepEqual((await createDemoApi(storage)("/rates")).rates, {
    landing: 0,
  });
  await assert.rejects(
    () => reloaded("/estimates/unknown", { method: "PUT", body: { project } }),
    /не найдена/,
  );
  await assert.rejects(
    () => reloaded("/auth/register", { method: "POST", body: {} }),
    /серверной версии/,
  );
  const otherBrowser = createDemoApi({
    getItem: () => null,
    setItem: () => {},
  });
  assert.deepEqual((await otherBrowser("/estimates")).estimates, []);
});

test("Pages demo reports blocked storage and invalid prices", async () => {
  const blocked = createDemoApi({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  });
  await assert.rejects(
    () =>
      blocked("/rates", { method: "PUT", body: { rates: { landing: 300 } } }),
    /Не удалось сохранить/,
  );
  await assert.rejects(() =>
    blocked("/rates", { method: "PUT", body: { rates: { landing: -1 } } }),
  );
});
