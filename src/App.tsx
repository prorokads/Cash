import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Component,
  Copy,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutTemplate,
  Layers2,
  LoaderCircle,
  LogOut,
  Minus,
  MonitorSmartphone,
  MousePointer2,
  PanelTop,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Estimate, Project, User } from "@/lib/types";
import {
  addons,
  calculate,
  defaultProject,
  estimateText,
  functions,
  money,
  services,
  urgencies,
} from "../shared/calculator.mjs";

const iconMap: Record<string, LucideIcon> = {
  layout: LayoutTemplate,
  layers: Layers2,
  panel: PanelTop,
  phone: Smartphone,
  responsive: MonitorSmartphone,
  search: Search,
  pointer: MousePointer2,
  component: Component,
  pen: PenTool,
  code: Code2,
};
const freshProject = (): Project => structuredClone(defaultProject);
const draftKey = "cash-guest-draft-v1";
function loadDraft(): Project {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    if (
      draft &&
      services.some((s) => s.id === draft.service) &&
      Number.isInteger(draft.quantity) &&
      draft.quantity >= 1 &&
      draft.quantity <= 100 &&
      Array.isArray(draft.addons) &&
      Array.isArray(draft.functions) &&
      urgencies.some((u) => u.id === draft.urgency) &&
      Number.isInteger(draft.discount) &&
      draft.discount >= 0 &&
      draft.discount <= 50 &&
      ["name", "client", "notes"].every(
        (key) => typeof draft[key] === "string",
      ) &&
      draft.rates &&
      Object.values(draft.rates).every(
        (n) =>
          typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n <= 10000000,
      )
    )
      return draft;
  } catch {
    /* Empty storage starts a fresh estimate. */
  }
  return freshProject();
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={cn("brand", small && "brand-small")}>
      <svg aria-hidden="true" viewBox="0 0 40 40" fill="none">
        <path
          d="M29 9H16L8 20l8 11h13v-8H19l-2-3 2-3h10V9Z"
          fill="currentColor"
        />
        <path d="M25 3v34" stroke="var(--background)" strokeWidth="2.5" />
      </svg>
      {!small && (
        <span>
          CASH<span className="brand-period">®</span>
        </span>
      )}
    </span>
  );
}
function SectionTitle({
  number,
  title,
  aside,
}: {
  number: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="step-number">{number}</span>
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}
function NumberField({
  value,
  min = 1,
  max = 100,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="stepper">
      <button
        aria-label={`Уменьшить: ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (
            e.target.value !== "" &&
            Number.isInteger(n) &&
            n >= min &&
            n <= max
          )
            onChange(n);
        }}
        onBlur={() => {
          const n = Math.max(
            min,
            Math.min(max, Math.round(Number(draft) || min)),
          );
          setDraft(String(n));
          onChange(n);
        }}
      />
      <button
        aria-label={`Увеличить: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function App() {
  const [project, setProject] = useState<Project>(loadDraft);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<"calculator" | "history">("calculator");
  const [modal, setModal] = useState<
    "auth" | "rates" | "preview" | "account" | "reset" | null
  >(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accountRates, setAccountRates] = useState<Record<string, number>>({});
  const [rateDraft, setRateDraft] = useState<Record<string, number>>({});
  const [previewFormat, setPreviewFormat] = useState<"text" | "md">("text");
  const [pendingSave, setPendingSave] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const result = calculate(project);
  const price = (id: string, fallback: number) => project.rates[id] ?? fallback;
  const update = <K extends keyof Project>(key: K, value: Project[K]) =>
    setProject((p) => ({ ...p, [key]: value }));
  const notify = (message: string) => {
    setToast(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setToast(""), 4000);
  };
  useEffect(() => {
    api<{ user: User | null }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch((e) => setError(e.message))
      .finally(() => setAuthReady(true));
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(project));
      } catch {
        /* Storage may be unavailable. */
      }
    }
  }, [project, user]);
  useEffect(() => {
    if (user) {
      api<{ rates: Record<string, number> }>("/rates")
        .then((data) => setAccountRates(data.rates))
        .catch((e) => setError(e.message));
    } else setAccountRates({});
  }, [user]);
  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await api<{ estimates: Estimate[] }>("/estimates");
      setEstimates(data.estimates);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }
  useEffect(() => {
    if (view === "history" && user) void loadHistory();
  }, [view, user]);
  function openAuth() {
    setAuthError("");
    setModal("auth");
  }
  async function saveEstimate(candidate = project) {
    if (!user) {
      setPendingSave(true);
      openAuth();
      return;
    }
    await persistEstimate(candidate);
  }
  async function persistEstimate(candidate: Project) {
    setBusy(true);
    setError("");
    const named = {
      ...candidate,
      name:
        candidate.name.trim() ||
        `Проект · ${calculate(candidate).service.title}`,
    };
    try {
      if (editingId)
        await api(`/estimates/${editingId}`, {
          method: "PUT",
          body: { project: named },
        });
      else {
        const data = await api<{ estimate: Estimate }>("/estimates", {
          method: "POST",
          body: { project: named },
        });
        setEditingId(data.estimate.id);
      }
      setProject(named);
      notify(
        editingId ? "Изменения сохранены" : "Смета сохранена в «Мои сметы»",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await api<{ user: User }>(`/auth/${authMode}`, {
        method: "POST",
        body: {
          email: form.get("email"),
          password: form.get("password"),
          ...(authMode === "register" ? { name: form.get("name") } : {}),
        },
      });
      setUser(data.user);
      setModal(null);
      setError("");
      notify(`Вы вошли как ${data.user.name}`);
      if (pendingSave) {
        setPendingSave(false);
        await persistEstimate(project);
      }
    } catch (e) {
      setAuthError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST", body: {} });
      setUser(null);
      setModal(null);
      setView("calculator");
      setEstimates([]);
      setEditingId(null);
      setProject(freshProject());
      notify("Вы вышли из аккаунта");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        estimateText(project, previewFormat === "md" && modal === "preview"),
      );
      notify("Смета скопирована");
    } catch {
      setModal("preview");
      setError(
        "Не удалось скопировать автоматически. Выделите текст сметы и скопируйте вручную.",
      );
    }
  }
  function download() {
    const blob = new Blob([estimateText(project, true)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(project.name.trim() || "смета-проекта").replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, "-").slice(0, 80)}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Markdown-файл скачан");
  }
  const toggle = (key: "addons" | "functions", id: string) =>
    update(
      key,
      project[key].includes(id)
        ? project[key].filter((s) => s !== id)
        : [...project[key], id],
    );
  function resetProject() {
    setProject({ ...freshProject(), rates: { ...accountRates } });
    setEditingId(null);
    setError("");
    setView("calculator");
    setModal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const rateItems = [
    ...services.flatMap((s) => [
      { id: s.id, title: s.title, rate: s.rate },
      { id: `${s.id}-extra`, title: `↳ Доп. ${s.singular}`, rate: s.extra },
    ]),
    ...addons,
    ...functions,
  ];

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Быстрая навигация">
        <button
          className="rail-logo"
          aria-label="CASH — калькулятор"
          onClick={() => setView("calculator")}
        >
          <Logo small />
        </button>
        <div className="rail-nav">
          <button
            title="Калькулятор"
            aria-label="Калькулятор"
            className={cn("rail-button", view === "calculator" && "active")}
            onClick={() => setView("calculator")}
          >
            <LayoutDashboard size={20} />
          </button>
          <button
            title="Мои сметы"
            aria-label="Мои сметы"
            className={cn("rail-button", view === "history" && "active")}
            onClick={() => setView("history")}
          >
            <FolderOpen size={20} />
          </button>
          <button
            title="Настроить тарифы"
            aria-label="Настроить тарифы"
            className="rail-button"
            onClick={() => {
              setRateDraft({ ...project.rates });
              setModal("rates");
            }}
          >
            <Settings2 size={20} />
          </button>
        </div>
        <a
          className="rail-bottom"
          href="https://alxdesign.ru/"
          target="_blank"
          rel="noreferrer"
          aria-label="Портфолио ALX"
        >
          <ArrowUpRight size={21} />
        </a>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="wordmark-button"
            onClick={() => setView("calculator")}
          >
            <Logo />
            <span className="by-alx">by ALX DSGN</span>
          </button>
          <nav className="main-nav" aria-label="Основная навигация">
            <button
              className={cn(view === "calculator" && "nav-active")}
              onClick={() => setView("calculator")}
            >
              Калькулятор
            </button>
            <button
              className={cn(view === "history" && "nav-active")}
              onClick={() => setView("history")}
            >
              Мои сметы
            </button>
          </nav>
          <Button
            variant="outline"
            className="auth-button"
            aria-label={user ? `Аккаунт: ${user.name}` : "Войти"}
            disabled={!authReady}
            onClick={() => (user ? setModal("account") : openAuth())}
          >
            <UserRound size={15} />
            <span>{user ? user.name : "Войти"}</span>
            {user && <ChevronDown size={12} />}
          </Button>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {view === "calculator" ? (
            <>
              <div className="page-eyebrow">
                <span>РАБОЧЕЕ ПРОСТРАНСТВО</span>
                <ChevronRight size={12} />
                <span>
                  {editingId ? "РЕДАКТИРОВАНИЕ СМЕТЫ" : "НОВАЯ СМЕТА"}
                </span>
              </div>
              <section className="intro">
                <div>
                  <div className="intro-kicker">
                    <span className="status-dot" /> МЕНЬШЕ РУТИНЫ. БОЛЬШЕ
                    ДИЗАЙНА.
                  </div>
                  <h1>
                    У хорошего дизайна
                    <br />
                    есть <span className="serif-accent">своя цена.</span>
                    <span className="title-star" aria-hidden="true">
                      ✳
                    </span>
                  </h1>
                  <p>Соберите проект по деталям. Стоимость посчитаем мы.</p>
                </div>
                <div className="intro-art" aria-hidden="true">
                  <div className="art-grid" />
                  <svg viewBox="0 0 220 170" fill="none">
                    <g stroke="#d5d5d2" strokeWidth="1.2">
                      <path d="m110 15 68 39v78l-68 39-68-39V54l68-39Z" />
                      <path d="m42 54 68 39 68-39M110 93v78M110 15v78M42 132l68-39 68 39" />
                      <path
                        d="m110 40 46 27v52l-46 27-46-27V67l46-27Z"
                        opacity=".38"
                      />
                      <path d="m64 67 46 26 46-26M110 93v53" opacity=".38" />
                    </g>
                    <path
                      d="M169 17v19M159.5 26.5h19M27 105v13M20.5 111.5h13"
                      stroke="#f1f1ed"
                    />
                    <circle cx="178" cy="132" r="4" fill="#f1f1ed" />
                    <circle cx="42" cy="54" r="3" fill="#f1f1ed" />
                  </svg>
                  <span>DESIGN IS A SYSTEM.</span>
                </div>
              </section>
              <div className="calculator-grid">
                <div className="config-panel">
                  <div className="project-top">
                    <div className="project-fields">
                      <label htmlFor="project-name">
                        НАЗВАНИЕ ПРОЕКТА
                        <Input
                          id="project-name"
                          value={project.name}
                          maxLength={120}
                          onChange={(e) => update("name", e.target.value)}
                          placeholder="Например, сайт для кофейни"
                          className="project-name"
                        />
                      </label>
                      <label htmlFor="client-name">
                        КЛИЕНТ <span className="optional">/ необязательно</span>
                        <Input
                          id="client-name"
                          value={project.client}
                          maxLength={120}
                          onChange={(e) => update("client", e.target.value)}
                          placeholder="Компания или имя"
                          className="project-name"
                        />
                      </label>
                    </div>
                    <button
                      className="reset-button"
                      title="Новая смета"
                      aria-label="Новая смета"
                      onClick={() => setModal("reset")}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                  <section className="config-section">
                    <SectionTitle
                      number="01"
                      title="Что будем создавать?"
                      aside={
                        <span className="section-hint">
                          ВЫБЕРИТЕ ТИП ПРОЕКТА
                        </span>
                      }
                    />
                    <div
                      className="service-grid"
                      role="radiogroup"
                      aria-label="Тип проекта"
                    >
                      {services.map((service) => {
                        const Icon = iconMap[service.icon];
                        const active = project.service === service.id;
                        return (
                          <button
                            key={service.id}
                            role="radio"
                            aria-checked={active}
                            className={cn("service-card", active && "selected")}
                            onClick={() =>
                              setProject((p) => ({
                                ...p,
                                service: service.id,
                                quantity: service.included,
                                addons:
                                  service.id === "mobile"
                                    ? p.addons.filter((id) => id !== "adaptive")
                                    : p.addons,
                              }))
                            }
                          >
                            <div className="service-card-top">
                              <Icon size={21} strokeWidth={1.4} />
                              <span className="radio-mark">
                                {active && <span />}
                              </span>
                            </div>
                            <h3>{service.title}</h3>
                            <p>{service.description}</p>
                            <span className="service-price">
                              от {money(price(service.id, service.rate))}
                              <ArrowUpRight size={14} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="config-section scope-section">
                    <SectionTitle number="02" title="Какой объём?" />
                    <div className="quantity-row">
                      <div>
                        <h3>Количество {result.service.unit}</h3>
                        <p>
                          Первые {result.service.included} включены. Далее —{" "}
                          {money(
                            price(
                              `${result.service.id}-extra`,
                              result.service.extra,
                            ),
                          )}{" "}
                          за {result.service.singular}.
                        </p>
                      </div>
                      <NumberField
                        value={project.quantity}
                        onChange={(v) => update("quantity", v)}
                        label={`Количество ${result.service.unit}`}
                      />
                    </div>
                    <div className="scope-meter">
                      <div
                        style={{
                          width: `${Math.min(100, project.quantity * 4)}%`,
                        }}
                      />
                    </div>
                    <div className="scope-labels">
                      <span>Компактный проект</span>
                      <span>Большой проект</span>
                    </div>
                  </section>
                  <section className="config-section">
                    <SectionTitle
                      number="03"
                      title="Добавим деталей"
                      aside={
                        <Badge variant="secondary">
                          {project.addons.length + project.functions.length}{" "}
                          выбрано
                        </Badge>
                      }
                    />
                    <div className="addon-list">
                      {addons
                        .filter(
                          (a) =>
                            project.service !== "mobile" || a.id !== "adaptive",
                        )
                        .map((addon) => {
                          const Icon = iconMap[addon.icon];
                          return (
                            <label
                              className={cn(
                                "addon-row",
                                project.addons.includes(addon.id) && "checked",
                              )}
                              key={addon.id}
                            >
                              <span className="addon-icon">
                                <Icon size={18} strokeWidth={1.5} />
                              </span>
                              <span className="addon-info">
                                <strong>{addon.title}</strong>
                                <span>{addon.description}</span>
                              </span>
                              <span className="addon-price">
                                +{money(price(addon.id, addon.rate))}
                              </span>
                              <Checkbox
                                aria-label={addon.title}
                                checked={project.addons.includes(addon.id)}
                                onCheckedChange={() =>
                                  toggle("addons", addon.id)
                                }
                              />
                            </label>
                          );
                        })}
                    </div>
                    <details className="feature-details">
                      <summary>
                        <span>
                          <Component size={16} /> Функциональные модули{" "}
                          <span className="muted">
                            {project.functions.length > 0 &&
                              `· ${project.functions.length}`}
                          </span>
                        </span>
                        <ChevronDown size={16} />
                      </summary>
                      <p className="feature-note">
                        Дизайн сценариев и состояний. Разработка рассчитывается
                        отдельно.
                      </p>
                      {functions.map((feature) => (
                        <label
                          className="addon-row feature-row"
                          key={feature.id}
                        >
                          <span className="addon-info">
                            <strong>{feature.title}</strong>
                            <span>{feature.description}</span>
                          </span>
                          <span className="addon-price">
                            +{money(price(feature.id, feature.rate))}
                          </span>
                          <Checkbox
                            aria-label={feature.title}
                            checked={project.functions.includes(feature.id)}
                            onCheckedChange={() =>
                              toggle("functions", feature.id)
                            }
                          />
                        </label>
                      ))}
                    </details>
                  </section>
                  <section className="config-section">
                    <SectionTitle number="04" title="Когда нужен результат?" />
                    <div
                      className="urgency-grid"
                      role="radiogroup"
                      aria-label="Срочность"
                    >
                      {urgencies.map((urgency, i) => {
                        const Icon =
                          i === 0 ? Clock3 : i === 1 ? Zap : Sparkles;
                        return (
                          <button
                            key={urgency.id}
                            role="radio"
                            aria-checked={project.urgency === urgency.id}
                            className={cn(
                              "urgency-option",
                              project.urgency === urgency.id && "selected",
                            )}
                            onClick={() => update("urgency", urgency.id)}
                          >
                            <div>
                              <Icon size={17} />
                              <span>
                                {i === 0
                                  ? "БЕЗ НАЦЕНКИ"
                                  : `+${Math.round((urgency.multiplier - 1) * 100)}%`}
                              </span>
                            </div>
                            <strong>{urgency.title}</strong>
                            <p>{urgency.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <section className="config-section final-options">
                    <div className="discount-row">
                      <div>
                        <h3>Скидка для клиента</h3>
                        <p>Если хочется сделать чуть приятнее</p>
                      </div>
                      <div className="discount-input">
                        <Input
                          aria-label="Скидка в процентах"
                          type="number"
                          min={0}
                          max={50}
                          value={project.discount}
                          onChange={(e) =>
                            update(
                              "discount",
                              Math.max(
                                0,
                                Math.min(
                                  50,
                                  Math.round(Number(e.target.value) || 0),
                                ),
                              ),
                            )
                          }
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <label className="notes-label" htmlFor="notes">
                      Примечания к смете{" "}
                      <span className="optional">/ необязательно</span>
                    </label>
                    <Textarea
                      id="notes"
                      value={project.notes}
                      maxLength={4000}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Пожелания, договорённости и важные детали проекта…"
                      rows={3}
                    />
                  </section>
                </div>
                <aside className="summary-column" aria-label="Расчёт стоимости">
                  <div className="receipt">
                    <div className="receipt-heading">
                      <span>
                        <FileText size={16} /> Ваша смета
                      </span>
                      <span className="live-badge">
                        <span /> LIVE
                      </span>
                    </div>
                    <div className="receipt-project">
                      <span>ПРОЕКТ / {result.service.id.toUpperCase()}</span>
                      <h2>{project.name || "Новый проект"}</h2>
                      <p>
                        {result.service.title} · {result.scopeLabel}
                      </p>
                    </div>
                    <div className="receipt-lines">
                      {result.lines.map((line) => (
                        <div key={line.id}>
                          <span>
                            {line.title}
                            {line.quantity > 1 && (
                              <small> × {line.quantity}</small>
                            )}
                          </span>
                          <span>{money(line.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="receipt-adjustments">
                      <div>
                        <span>
                          Срочность{" "}
                          <small>×{result.urgency.multiplier.toFixed(2)}</small>
                        </span>
                        <span>
                          {result.urgencyFee
                            ? `+${money(result.urgencyFee)}`
                            : "Без наценки"}
                        </span>
                      </div>
                      {project.discount > 0 && (
                        <div>
                          <span>Скидка {project.discount}%</span>
                          <span>−{money(result.discountAmount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="receipt-total">
                      <span>ИТОГОВАЯ СТОИМОСТЬ</span>
                      <div aria-live="polite" aria-atomic="true">
                        {new Intl.NumberFormat("ru-RU").format(result.total)}
                        <span>₽</span>
                      </div>
                      <p>
                        <Clock3 size={13} /> ≈ {result.daysLabel}
                      </p>
                    </div>
                    <div className="receipt-included">
                      <span>
                        <Check size={13} /> Исходники в Figma
                      </span>
                      <span>
                        <Check size={13} /> 2 круга правок
                      </span>
                    </div>
                    <div className="receipt-actions">
                      <Button
                        size="lg"
                        className="w-full"
                        onClick={() => {
                          setPreviewFormat("text");
                          setModal("preview");
                        }}
                      >
                        Посмотреть смету
                        <ArrowUpRight size={16} />
                      </Button>
                      <div>
                        <Button variant="outline" onClick={copy}>
                          <Copy size={14} />
                          Копировать
                        </Button>
                        <Button variant="outline" onClick={download}>
                          <ArrowDownToLine size={14} />
                          .md
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        className="save-button w-full"
                        disabled={busy || !authReady}
                        onClick={() => saveEstimate()}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" size={14} />
                        ) : (
                          <Save size={14} />
                        )}{" "}
                        {editingId ? "Сохранить изменения" : "Сохранить смету"}
                      </Button>
                    </div>
                    <div className="receipt-footer">
                      <Logo small />
                      <span>СОЗДАНО С ВНИМАНИЕМ К ДЕТАЛЯМ</span>
                    </div>
                  </div>
                  <p className="estimate-disclaimer">
                    Предварительная оценка. Точную стоимость и сроки зафиксируем
                    после обсуждения задачи.
                  </p>
                  <button
                    className="rates-link"
                    onClick={() => {
                      setRateDraft({ ...project.rates });
                      setModal("rates");
                    }}
                  >
                    <Settings2 size={14} /> Настроить свои тарифы
                    <ArrowUpRight size={13} />
                  </button>
                  <div className="design-note">
                    <span className="design-note-symbol">↗</span>
                    <p>
                      От первой идеи
                      <br />
                      до последнего пикселя.
                    </p>
                    <span>ALX DSGN — DIGITAL DESIGN</span>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="page-eyebrow">
                РАБОЧЕЕ ПРОСТРАНСТВО <ChevronRight size={12} /> МОИ СМЕТЫ
              </div>
              <div className="history-heading">
                <div>
                  <h1>
                    Всё по <span className="serif-accent">полочкам.</span>
                  </h1>
                  <p>Ваши проекты, расчёты и договорённости.</p>
                </div>
                <Button onClick={() => setModal("reset")}>
                  <Plus size={16} />
                  Новая смета
                </Button>
              </div>
              {!user ? (
                <div className="empty-state">
                  <FolderOpen size={40} strokeWidth={1} />
                  <h2>Сметы будут ждать здесь</h2>
                  <p>
                    Войдите, чтобы сохранять проекты
                    <br />и возвращаться к ним в любое время.
                  </p>
                  <Button onClick={openAuth}>
                    Войти в аккаунт
                    <ArrowUpRight size={15} />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="history-toolbar">
                    <div className="history-search">
                      <Search size={16} />
                      <Input
                        aria-label="Поиск смет"
                        placeholder="Найти проект или клиента"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <span>{estimates.length} сохранено</span>
                  </div>
                  {historyLoading ? (
                    <div className="empty-state">
                      <LoaderCircle className="animate-spin" />
                      Загружаем сметы…
                    </div>
                  ) : historyError ? (
                    <div className="empty-state" role="alert">
                      <h2>Не удалось загрузить сметы</h2>
                      <p>{historyError}</p>
                      <Button onClick={loadHistory}>Повторить</Button>
                    </div>
                  ) : estimates.length === 0 ? (
                    <div className="empty-state">
                      <FileText size={40} strokeWidth={1} />
                      <h2>Первая смета — начало проекта</h2>
                      <p>
                        Настройте услуги в калькуляторе и сохраните результат.
                      </p>
                      <Button onClick={() => setView("calculator")}>
                        К калькулятору
                        <ArrowUpRight size={15} />
                      </Button>
                    </div>
                  ) : (
                    <div className="history-list">
                      {estimates
                        .filter((item) =>
                          `${item.project.name} ${item.project.client}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((item) => (
                          <button
                            className="history-item"
                            key={item.id}
                            onClick={() => {
                              setProject(item.project);
                              setEditingId(item.id);
                              setView("calculator");
                              window.scrollTo(0, 0);
                            }}
                          >
                            <span className="history-icon">
                              <FileText size={21} />
                            </span>
                            <span className="history-item-info">
                              <strong>{item.project.name}</strong>
                              <span>
                                {item.project.client ||
                                  calculate(item.project).service.title}{" "}
                                <span>
                                  ·{" "}
                                  {new Date(item.updated).toLocaleDateString(
                                    "ru-RU",
                                  )}
                                </span>
                              </span>
                            </span>
                            <span className="history-item-total">
                              {money(item.total)}
                            </span>
                            <ArrowUpRight size={18} />
                          </button>
                        ))}
                      {estimates.length > 0 &&
                        !estimates.some((item) =>
                          `${item.project.name} ${item.project.client}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        ) && (
                          <div className="empty-state">
                            <Search size={30} />
                            <h2>Ничего не нашлось</h2>
                            <p>Попробуйте другое название или имя клиента.</p>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              CASH® <span>© {new Date().getFullYear()}</span>
            </span>
            <span>СЧИТАЕМ СТОИМОСТЬ. ЦЕНИМ ДИЗАЙН.</span>
            <a href="https://alxdesign.ru/" target="_blank" rel="noreferrer">
              Сделано в ALX DSGN <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <Dialog
        open={modal === "auth"}
        onOpenChange={(open) => {
          if (!open) {
            setModal(null);
            setPendingSave(false);
          }
        }}
      >
        <DialogContent className="auth-modal">
          <DialogHeader>
            <Logo />
            <DialogTitle>
              {authMode === "login"
                ? "С возвращением."
                : "Начнём с знакомства."}
            </DialogTitle>
            <DialogDescription>
              {pendingSave
                ? "Войдите или создайте аккаунт, чтобы сохранить эту смету."
                : "Ваши проекты и сметы — в одном месте."}
            </DialogDescription>
          </DialogHeader>
          <div className="auth-tabs">
            <button
              className={cn(authMode === "login" && "active")}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
            >
              Вход
            </button>
            <button
              className={cn(authMode === "register" && "active")}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
            >
              Регистрация
            </button>
          </div>
          <form onSubmit={authenticate} className="auth-form">
            {authMode === "register" && (
              <label>
                Ваше имя
                <Input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Александр"
                />
              </label>
            )}
            <label>
              Email
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                placeholder="you@design.studio"
              />
            </label>
            <label>
              Пароль
              <Input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                placeholder={
                  authMode === "login" ? "Ваш пароль" : "Не менее 8 символов"
                }
              />
            </label>
            {authError && (
              <p className="form-error" role="alert">
                {authError}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : authMode === "login" ? (
                "Войти"
              ) : (
                "Создать аккаунт"
              )}
              <ArrowUpRight size={16} />
            </Button>
          </form>
          <p className="auth-footnote">
            <ShieldCheck size={14} />
            Данные хранятся локально на этом компьютере.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "preview"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent className="preview-modal">
          <DialogHeader>
            <DialogTitle>Смета готова.</DialogTitle>
            <DialogDescription>
              Все детали проекта в одном документе. Можно отправлять клиенту.
            </DialogDescription>
          </DialogHeader>
          <div className="preview-toolbar">
            <div className="format-tabs">
              <button
                className={cn(previewFormat === "text" && "active")}
                onClick={() => setPreviewFormat("text")}
              >
                Текст
              </button>
              <button
                className={cn(previewFormat === "md" && "active")}
                onClick={() => setPreviewFormat("md")}
              >
                Markdown
              </button>
            </div>
            <span>{money(result.total)}</span>
          </div>
          <Textarea
            aria-label="Готовая смета"
            className="estimate-preview"
            readOnly
            value={estimateText(project, previewFormat === "md")}
          />
          <div className="preview-actions">
            <Button variant="outline" onClick={copy}>
              <Copy size={15} />
              Копировать {previewFormat === "md" ? "Markdown" : "текст"}
            </Button>
            <Button onClick={download}>
              <ArrowDownToLine size={15} />
              Скачать .md
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "rates"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent className="rates-modal">
          <DialogHeader>
            <DialogTitle>Ваш дизайн. Ваши тарифы.</DialogTitle>
            <DialogDescription>
              Цены в рублях. Сохранённые сметы останутся со своими тарифами.
            </DialogDescription>
          </DialogHeader>
          <div className="rates-list">
            {rateItems.map((item) => (
              <label key={item.id}>
                <span>{item.title}</span>
                <div>
                  <Input
                    aria-label={`Тариф: ${item.title}`}
                    type="number"
                    min={0}
                    max={10000000}
                    step={500}
                    value={rateDraft[item.id] ?? item.rate}
                    onChange={(e) =>
                      setRateDraft((p) => ({
                        ...p,
                        [item.id]: Math.min(
                          10000000,
                          Math.max(0, Math.round(Number(e.target.value) || 0)),
                        ),
                      }))
                    }
                  />
                  <span>₽</span>
                </div>
              </label>
            ))}
          </div>
          <p className="small-muted">
            {user
              ? "Тарифы сохранятся в аккаунте и применятся к текущему и новым расчётам."
              : "Тарифы применятся к текущему расчёту. Войдите, чтобы сохранить свой прайс в аккаунте."}
          </p>
          <div className="preview-actions">
            <Button variant="ghost" onClick={() => setRateDraft({})}>
              <RotateCcw size={14} />
              Исходные тарифы
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (user) {
                    await api("/rates", {
                      method: "PUT",
                      body: { rates: rateDraft },
                    });
                    setAccountRates(rateDraft);
                  }
                  update("rates", rateDraft);
                  setModal(null);
                  notify("Тарифы обновлены");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Применить
              <Check size={15} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "account"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent className="account-modal">
          <DialogHeader>
            <DialogTitle>Ваше пространство</DialogTitle>
            <DialogDescription>
              Сметы и тарифы привязаны к этому аккаунту.
            </DialogDescription>
          </DialogHeader>
          <div className="account-details">
            <span className="account-avatar">
              {user?.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setView("history");
              setModal(null);
            }}
          >
            <FolderOpen size={16} />
            Мои сметы
            <ChevronRight size={15} />
          </Button>
          <Button variant="ghost" disabled={busy} onClick={logout}>
            <LogOut size={16} />
            Выйти из аккаунта
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "reset"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent className="account-modal">
          <DialogHeader>
            <DialogTitle>Начнём новый проект?</DialogTitle>
            <DialogDescription>
              Текущий расчёт будет сброшен. Если хотите к нему вернуться,
              сначала сохраните смету.
            </DialogDescription>
          </DialogHeader>
          <div className="preview-actions">
            <Button variant="outline" onClick={() => setModal(null)}>
              <ArrowLeft size={14} />
              Продолжить
            </Button>
            <Button onClick={resetProject}>
              <Plus size={15} />
              Новая смета
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
