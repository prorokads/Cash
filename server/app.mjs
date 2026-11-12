import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { projectSchema, ratesSchema } from "../shared/project-schema.mjs";
import {
  calculate,
  services,
  addons,
  functions,
  urgencies,
} from "../shared/calculator.mjs";

const scrypt = promisify(scryptCallback);
const sessionAge = 7 * 86400;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});

export function createApp({
  database = path.resolve("data/cash.sqlite"),
  production = false,
} = {}) {
  if (database !== ":memory:")
    mkdirSync(path.dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, salt TEXT NOT NULL, rates TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS estimates (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), project TEXT NOT NULL, total INTEGER NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);`);
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Ожидается JSON." });
      const origin = req.get("origin");
      const allowed = production
        ? [process.env.APP_ORIGIN || "http://127.0.0.1:3001"]
        : [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
          ];
      if (origin && !allowed.includes(origin))
        return res
          .status(403)
          .json({ error: "Недопустимый источник запроса." });
    }
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use((req, _res, next) => {
    const raw = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("cash_session="))
      ?.slice(13);
    req.sessionHash = raw ? hash(raw) : "";
    req.user = db
      .prepare(
        "SELECT u.id, u.email, u.name FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires > ?",
      )
      .get(req.sessionHash, Date.now());
    next();
  });
  const limiter = new Map();
  function limit(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const entry = limiter.get(key);
    if (entry && entry.until > now && entry.count >= 15)
      return res
        .status(429)
        .json({ error: "Слишком много попыток. Попробуйте через 15 минут." });
    if (!entry || entry.until <= now)
      limiter.set(key, { count: 1, until: now + 15 * 60000 });
    else entry.count++;
    if (limiter.size > 1000)
      for (const [ip, record] of limiter)
        if (record.until <= now) limiter.delete(ip);
    next();
  }
  function session(res, userId) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
    db.prepare(
      "INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)",
    ).run(hash(token), userId, Date.now() + sessionAge * 1000);
    res.cookie("cash_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: production && process.env.APP_ORIGIN?.startsWith("https://"),
      maxAge: sessionAge * 1000,
      path: "/",
    });
  }
  function requireUser(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Войдите в аккаунт." });
    next();
  }
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user ?? null }));
  app.post("/api/auth/register", limit, async (req, res) => {
    const data = credentials
      .extend({ name: z.string().trim().min(1).max(80) })
      .parse(req.body);
    const salt = randomBytes(16).toString("hex");
    const password = Buffer.from(
      await scrypt(data.password, salt, 64),
    ).toString("hex");
    let id;
    try {
      id = Number(
        db
          .prepare(
            "INSERT INTO users (email, name, password, salt) VALUES (?, ?, ?, ?)",
          )
          .run(data.email, data.name, password, salt).lastInsertRowid,
      );
    } catch (err) {
      if (err.message.includes("UNIQUE"))
        return res
          .status(409)
          .json({ error: "Аккаунт с таким email уже существует." });
      throw err;
    }
    session(res, id);
    res.status(201).json({ user: { id, email: data.email, name: data.name } });
  });
  app.post("/api/auth/login", limit, async (req, res) => {
    const data = credentials.parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(data.email);
    const derived = Buffer.from(
      await scrypt(data.password, user?.salt ?? "missing-user-salt", 64),
    );
    if (!user || !timingSafeEqual(derived, Buffer.from(user.password, "hex")))
      return res.status(401).json({ error: "Неверный email или пароль." });
    if (req.sessionHash)
      db.prepare("DELETE FROM sessions WHERE token = ?").run(req.sessionHash);
    session(res, user.id);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(req.sessionHash);
    res.clearCookie("cash_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/rates", requireUser, (req, res) =>
    res.json({
      rates: JSON.parse(
        db.prepare("SELECT rates FROM users WHERE id = ?").get(req.user.id)
          .rates,
      ),
    }),
  );
  app.put("/api/rates", requireUser, (req, res) => {
    const rates = ratesSchema.parse(req.body.rates);
    db.prepare("UPDATE users SET rates = ? WHERE id = ?").run(
      JSON.stringify(rates),
      req.user.id,
    );
    res.json({ rates });
  });
  app.get("/api/estimates", requireUser, (req, res) => {
    const rows = db
      .prepare(
        "SELECT id, project, total, created, updated FROM estimates WHERE user_id = ? ORDER BY updated DESC LIMIT 200",
      )
      .all(req.user.id);
    res.json({
      estimates: rows.map((row) => ({
        ...row,
        project: JSON.parse(row.project),
      })),
    });
  });
  app.post("/api/estimates", requireUser, (req, res) => {
    const project = projectSchema.parse(req.body.project);
    const id = randomBytes(12).toString("hex"),
      now = new Date().toISOString();
    const total = calculate(project).total;
    db.prepare(
      "INSERT INTO estimates (id, user_id, project, total, created, updated) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, req.user.id, JSON.stringify(project), total, now, now);
    res
      .status(201)
      .json({ estimate: { id, project, total, created: now, updated: now } });
  });
  app.put("/api/estimates/:id", requireUser, (req, res) => {
    const project = projectSchema.parse(req.body.project),
      total = calculate(project).total,
      now = new Date().toISOString();
    const result = db
      .prepare(
        "UPDATE estimates SET project = ?, total = ?, updated = ? WHERE id = ? AND user_id = ?",
      )
      .run(JSON.stringify(project), total, now, req.params.id, req.user.id);
    if (!result.changes)
      return res.status(404).json({ error: "Смета не найдена." });
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Не найдено." }),
  );
  if (production) {
    app.use(express.static(path.resolve("dist")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.resolve("dist/index.html")),
    );
  }
  app.use((err, _req, res, _next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: "Проверьте введённые данные.",
          details: err.issues.map((i) => i.path.join(".")),
        });
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large")
      return res.status(400).json({ error: "Некорректный запрос." });
    console.error(err);
    res
      .status(500)
      .json({ error: "Не удалось выполнить запрос. Попробуйте ещё раз." });
  });
  return { app, db };
}
