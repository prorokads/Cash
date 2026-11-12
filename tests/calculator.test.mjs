import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  defaultProject,
  estimateText,
} from "../shared/calculator.mjs";

test("base allowance, extra quantity, urgency and discount use the correct order", () => {
  const project = {
    ...structuredClone(defaultProject),
    quantity: 8,
    urgency: "fast",
    discount: 10,
    functions: ["forms"],
  };
  const r = calculate(project);
  assert.equal(r.subtotal, 30000 + 3 * 3500 + 12000 + 4000);
  assert.equal(r.urgencyFee, Math.round(r.subtotal * 0.25));
  assert.equal(r.discountAmount, Math.round((r.subtotal + r.urgencyFee) * 0.1));
  assert.equal(r.total, 63562);
  assert.equal(r.days, 10);
  assert.equal(
    calculate({ ...project, quantity: 1 }).lines.some((l) => l.id === "extra"),
    false,
  );
});
test("custom zero price is valid, saved snapshots retain original totals", () => {
  const project = {
    ...structuredClone(defaultProject),
    rates: { landing: 50000, adaptive: 0 },
  };
  const snapshot = structuredClone(project);
  assert.equal(calculate(project).total, 50000);
  project.rates.landing = 90000;
  assert.equal(calculate(snapshot).total, 50000);
});
test("both export formats describe every item, rates and exclusions", () => {
  const project = {
    ...structuredClone(defaultProject),
    name: "Сайт | Кофейня",
    client: "Клиент",
    notes: "Два этапа",
    discount: 5,
    urgency: "express",
    functions: ["account"],
  };
  const text = estimateText(project, false, new Date("2026-11-12T12:00:00Z"));
  const md = estimateText(project, true, new Date("2026-11-12T12:00:00Z"));
  assert.ok(md.startsWith("# Смета: Сайт  Кофейня"));
  assert.ok(md.includes("**Итого:"));
  assert.ok(text.includes("ИТОГО:"));
  for (const output of [text, md]) {
    assert.ok(output.includes("Личный кабинет"));
    assert.ok(output.includes("Скидка 5%"));
    assert.ok(
      output.includes("Программирование и платные материалы не включены"),
    );
    assert.ok(output.includes("Два этапа"));
  }
});
