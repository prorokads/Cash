import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.mjs";
import { defaultProject, calculate } from "../shared/calculator.mjs";

test("authentication, session isolation, persisted rates and estimate validation", async (t) => {
  const { app, db } = createApp({ database: ":memory:" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => {
    server.close();
    db.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const request = (
    endpoint,
    method = "GET",
    body,
    cookie,
    origin = "http://127.0.0.1:5173",
  ) =>
    fetch(url + endpoint, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        Origin: origin,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  assert.equal((await request("/estimates")).status, 401);
  assert.equal(
    (
      await request("/auth/register", "POST", {
        email: "a@example.com",
        password: "short",
        name: "A",
      })
    ).status,
    400,
  );
  const register = await request("/auth/register", "POST", {
    email: "a@example.com",
    password: "correct-pass-123",
    name: "Designer",
  });
  assert.equal(register.status, 201);
  const cookie = register.headers.get("set-cookie").split(";")[0];
  assert.ok(register.headers.get("set-cookie").includes("HttpOnly"));
  const storedUser = db.prepare("SELECT password FROM users").get();
  assert.notEqual(storedUser.password, "correct-pass-123");
  assert.equal(
    (
      await request("/auth/login", "POST", {
        email: "a@example.com",
        password: "wrong-pass",
      })
    ).status,
    401,
  );
  assert.equal(
    (await request("/auth/me", "GET", undefined, cookie)).status,
    200,
  );
  const loggedIn = await request("/auth/login", "POST", {
    email: "a@example.com",
    password: "correct-pass-123",
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(
    (
      await request(
        "/rates",
        "PUT",
        { rates: { landing: 0 } },
        cookie,
        "https://attacker.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/rates", "PUT", { rates: { landing: 45000 } }, cookie))
      .status,
    200,
  );
  assert.deepEqual(
    (await (await request("/rates", "GET", undefined, cookie)).json()).rates,
    { landing: 45000 },
  );
  assert.equal(
    (await request("/rates", "PUT", { rates: { landing: -1 } }, cookie)).status,
    400,
  );
  const project = {
    ...structuredClone(defaultProject),
    name: "Test",
    rates: { landing: 45000 },
    functions: ["forms"],
  };
  const save = await request(
    "/estimates",
    "POST",
    { project, total: 1 },
    cookie,
  );
  assert.equal(save.status, 201);
  const { estimate } = await save.json();
  assert.equal(estimate.total, calculate(project).total);
  assert.equal(
    (
      await request(
        "/estimates",
        "POST",
        { project: { ...project, quantity: -5 } },
        cookie,
      )
    ).status,
    400,
  );
  const userB = await request("/auth/register", "POST", {
    email: "b@example.com",
    password: "correct-pass-456",
    name: "B",
  });
  const cookieB = userB.headers.get("set-cookie").split(";")[0];
  assert.deepEqual(
    (await (await request("/estimates", "GET", undefined, cookieB)).json())
      .estimates,
    [],
  );
  assert.equal(
    (await request(`/estimates/${estimate.id}`, "PUT", { project }, cookieB))
      .status,
    404,
  );
  assert.equal(
    (
      await request(
        `/estimates/${estimate.id}`,
        "PUT",
        { project: { ...project, name: "Updated" } },
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await request("/estimates", "GET", undefined, cookie)).json())
      .estimates[0].project.name,
    "Updated",
  );
  assert.equal((await request("/auth/logout", "POST", {}, cookie)).status, 200);
  assert.equal(
    (await request("/estimates", "GET", undefined, cookie)).status,
    401,
  );
});
