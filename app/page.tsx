"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Unit = "piece" | "gram" | "ounce" | "pound" | "cup" | "serving";
type Food = { id: string; name: string; emoji: string; calories: number; unit: Unit; amount: number };
type Log = Food & { logId: string; quantity: number; date: string };
type Weight = { id: string; value: number; date: string };
type TrackerData = { foods: Food[]; logs: Log[]; weights: Weight[]; goal: number };
type Tab = "today" | "inventory" | "progress";
type Sheet = "food" | "new-food" | "weight" | "username" | null;
type SyncStatus = "idle" | "loading" | "saving" | "saved" | "offline";

const starterFoods: Food[] = [
  { id: "egg", name: "Boiled egg", emoji: "🥚", calories: 78, unit: "piece", amount: 1 },
  { id: "banana", name: "Banana", emoji: "🍌", calories: 105, unit: "piece", amount: 1 },
  { id: "chicken", name: "Chicken breast", emoji: "🍗", calories: 165, unit: "gram", amount: 100 },
  { id: "rice", name: "Cooked rice", emoji: "🍚", calories: 205, unit: "cup", amount: 1 },
  { id: "avocado", name: "Avocado", emoji: "🥑", calories: 240, unit: "piece", amount: 1 },
];

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const perLabel = (food: Food) => `${food.amount === 1 ? "" : `${food.amount} `}${food.unit}`;
const caloriesFor = (food: Food, quantity: number) => Math.round(food.calories * quantity / food.amount);

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const icons = {
  home: <Svg><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></Svg>,
  box: <Svg><path d="m21 8-9 5-9-5M3 8l9-5 9 5v8l-9 5-9-5Z" /><path d="M12 13v8" /></Svg>,
  chart: <Svg><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /></Svg>,
  plus: <Svg><path d="M12 5v14M5 12h14" /></Svg>,
  search: <Svg><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Svg>,
  chevron: <Svg><path d="m9 18 6-6-6-6" /></Svg>,
  trash: <Svg size={17}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></Svg>,
  close: <Svg><path d="m6 6 12 12M18 6 6 18" /></Svg>,
  scale: <Svg><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 10a4 4 0 0 1 8 0M12 10l2-2" /></Svg>,
  calendar: <Svg><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></Svg>,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

const label = "mb-1.5 block text-[10px] font-black uppercase tracking-[.15em] text-ink/50";
const input = "h-13 w-full rounded-2xl border border-ink/15 bg-white px-4 text-sm outline-none transition focus:border-moss focus:ring-4 focus:ring-moss/10";

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(localDate());
  const [foods, setFoods] = useState<Food[]>(starterFoods);
  const [logs, setLogs] = useState<Log[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [goal, setGoal] = useState(2200);
  const [ready, setReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFoods(read("pace-foods", starterFoods)); setLogs(read("pace-logs", []));
    setWeights(read("pace-weights", [])); setGoal(read("pace-goal", 2200));
    const savedUsername = localStorage.getItem("pace-username") || "";
    if (savedUsername) setUsername(savedUsername); else setSheet("username");
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("pace-foods", JSON.stringify(foods)); }, [foods, ready]);
  useEffect(() => { if (ready) localStorage.setItem("pace-logs", JSON.stringify(logs)); }, [logs, ready]);
  useEffect(() => { if (ready) localStorage.setItem("pace-weights", JSON.stringify(weights)); }, [weights, ready]);
  useEffect(() => { if (ready) localStorage.setItem("pace-goal", JSON.stringify(goal)); }, [goal, ready]);

  useEffect(() => {
    if (!ready || !username) return;
    let cancelled = false;
    setCloudReady(false); setSyncStatus("loading");

    async function loadTracker() {
      try {
        const response = await fetch(`/api/tracker/${encodeURIComponent(username)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Cloud storage unavailable");
        const result = await response.json();
        if (cancelled) return;
        if (result.exists && result.data) {
          const data = result.data as TrackerData;
          setFoods(data.foods); setLogs(data.logs); setWeights(data.weights); setGoal(data.goal);
          setCloudReady(true); setSyncStatus("saved");
        } else {
          const create = await fetch(`/api/tracker/${encodeURIComponent(username)}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ foods, logs, weights, goal }),
          });
          if (!create.ok) throw new Error("Cloud storage unavailable");
          if (!cancelled) { setCloudReady(true); setSyncStatus("saved"); }
        }
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    }
    loadTracker();
    return () => { cancelled = true; };
    // Loading should run only when the selected username changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, username]);

  useEffect(() => {
    if (!cloudReady || !username) return;
    setSyncStatus("saving");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/tracker/${encodeURIComponent(username)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foods, logs, weights, goal }),
        });
        setSyncStatus(response.ok ? "saved" : "offline");
      } catch { setSyncStatus("offline"); }
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [foods, logs, weights, goal, cloudReady, username]);

  const dayLogs = logs.filter((entry) => entry.date === date);
  const eaten = dayLogs.reduce((total, entry) => total + caloriesFor(entry, entry.quantity), 0);
  const remaining = Math.max(goal - eaten, 0);
  const latestWeight = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const shownFoods = foods.filter((food) => food.name.toLowerCase().includes(search.toLowerCase()));
  const dateName = useMemo(() => date === localDate() ? "Today" : new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), [date]);

  function shiftDay(change: number) {
    const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + change); setDate(localDate(next));
  }
  function openFood(food?: Food) {
    setSearch(""); setSelected(food || null); setQuantity(food?.amount || 1); setSheet("food");
  }
  function addToLog() {
    if (!selected || quantity <= 0) return;
    setLogs((current) => [...current, { ...selected, logId: id(), quantity, date }]); setSheet(null);
  }
  function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const food: Food = { id: id(), name: String(data.get("name")), emoji: String(data.get("emoji") || "🥡"), calories: Number(data.get("calories")), amount: Number(data.get("amount")), unit: data.get("unit") as Unit };
    if (!food.name || food.calories <= 0 || food.amount <= 0) return;
    setFoods((current) => [food, ...current]); setSheet(null);
  }
  function addWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const value = Number(data.get("weight")); const weightDate = String(data.get("date"));
    if (value <= 0) return;
    setWeights((current) => [...current.filter((entry) => entry.date !== weightDate), { id: id(), value, date: weightDate }]); setSheet(null);
  }
  function chooseUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("username") || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,32}$/.test(value)) { setUsernameError("Use 3–32 letters, numbers, _ or -."); return; }
    setUsernameError(""); localStorage.setItem("pace-username", value); setCloudReady(false); setUsername(value); setSheet(null);
  }

  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  const syncLabel = syncStatus === "loading" ? "Loading" : syncStatus === "saving" ? "Saving" : syncStatus === "saved" ? "Synced" : syncStatus === "offline" ? "Local only" : "";

  return <main className="min-h-dvh bg-city pb-24 text-ink md:pl-20 md:pb-0">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r border-ink/10 bg-[#f8faf5] py-6 md:flex">
      <div className="grid size-10 place-items-center rounded-xl bg-ink text-xl font-black italic text-acid">p</div>
      <nav className="my-auto grid gap-3" aria-label="Main navigation">
        <RailButton active={tab === "today"} title="Today" onClick={() => setTab("today")}>{icons.home}</RailButton>
        <RailButton active={tab === "inventory"} title="Inventory" onClick={() => setTab("inventory")}>{icons.box}</RailButton>
        <RailButton active={tab === "progress"} title="Progress" onClick={() => setTab("progress")}>{icons.chart}</RailButton>
      </nav>
      <button onClick={() => setSheet("username")} title="Switch username" className="grid size-9 place-items-center rounded-full bg-[#dbe8ce] text-[10px] font-black">{initials}</button>
    </aside>

    <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10 lg:px-14">
      <header className="flex items-start justify-between pb-7 pt-5 md:pb-10 md:pt-10">
        <div>
          <div className="mb-7 grid size-9 place-items-center rounded-xl bg-ink text-xl font-black italic text-acid md:hidden">p</div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[.18em] text-ink/45">Built for the pace</p>
          <h1 className="font-display text-[36px] leading-none tracking-[-.045em] md:text-5xl">{tab === "today" ? "Keep moving." : tab === "inventory" ? "Your go-to fuel." : "Momentum, measured."}</h1>
        </div>
        <button onClick={() => setSheet("username")} aria-label="Switch username" className="mt-1 grid size-10 place-items-center rounded-full bg-[#dbe8ce] text-[10px] font-black md:hidden">{initials}</button>
      </header>
      {username && <button onClick={() => setSheet("username")} className="-mt-4 mb-5 flex items-center gap-2 text-[10px] font-bold text-ink/45 md:-mt-7 md:mb-7"><span className={`size-1.5 rounded-full ${syncStatus === "offline" ? "bg-orange-500" : syncStatus === "saved" ? "bg-green-600" : "bg-ink/25"}`} />@{username} · {syncLabel}</button>}

      {tab === "today" && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7">
        <section>
          <div className="mb-3 grid h-12 grid-cols-[44px_1fr_44px] items-center rounded-2xl border border-ink/10 bg-white shadow-[0_3px_14px_#183f2e0a]">
            <button onClick={() => shiftDay(-1)} className="grid h-full place-items-center" aria-label="Previous day"><span className="rotate-180">{icons.chevron}</span></button>
            <div className="flex items-center justify-center gap-2 text-xs">{icons.calendar}<strong>{dateName}</strong><span className="text-[10px] text-ink/40">{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
            <button disabled={date >= localDate()} onClick={() => shiftDay(1)} className="grid h-full place-items-center disabled:opacity-20" aria-label="Next day">{icons.chevron}</button>
          </div>

          <article className="relative overflow-hidden rounded-[26px] bg-ink p-6 text-white shadow-[0_18px_45px_#10251b24] sm:p-8">
            <div className="absolute -right-12 -top-14 size-44 rounded-full border-[30px] border-white/[.025]" />
            <div className="relative flex items-start justify-between gap-3">
              <div><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-white/55">Calories left</p><div><strong className="font-display text-5xl font-normal tracking-[-.055em] sm:text-6xl">{remaining.toLocaleString()}</strong><span className="ml-2 text-xs text-white/55">kcal</span></div></div>
              <button onClick={() => { const value = prompt("Daily calorie goal", String(goal)); if (value && Number(value) > 0) setGoal(Number(value)); }} className="rounded-full border border-white/15 bg-white/[.06] px-3 py-2 text-[10px] font-bold text-white/80">Goal · {goal.toLocaleString()}</button>
            </div>
            <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-acid transition-all" style={{ width: `${Math.min(eaten / goal, 1) * 100}%` }} /></div>
            <div className="mt-3 flex justify-between text-[10px] text-white/50"><span><b className="text-white">{eaten.toLocaleString()}</b> eaten</span><span><b className="text-white">{Math.round(eaten / goal * 100) || 0}%</b> of goal</span></div>
            <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5"><p className="max-w-[210px] font-display text-lg leading-tight text-white/85">Small choices. Big city energy.</p><span className="text-[22px]">↗</span></div>
          </article>

          <SectionTitle eyebrow="Today's log" title="What you ate"><button onClick={() => openFood()} className="flex h-10 items-center gap-1.5 rounded-xl bg-moss px-3.5 text-xs font-bold text-white">{icons.plus}<span>Add food</span></button></SectionTitle>
          <div className="grid gap-2.5">
            {dayLogs.length === 0 ? <button onClick={() => openFood()} className="flex min-h-40 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-ink/20 bg-white/70 text-center"><span className="mb-3 grid size-10 place-items-center rounded-full bg-[#e4efd8] text-2xl">+</span><strong className="text-sm">Your day starts here</strong><small className="mt-1 text-[11px] text-ink/45">Log a meal, snack, or coffee run</small></button> : dayLogs.map((entry) => <article key={entry.logId} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 shadow-[0_3px_12px_#183f2e08]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0f3eb] text-2xl">{entry.emoji}</span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{entry.name}</h3><p className="mt-1 text-[11px] text-ink/45">{entry.quantity} {entry.unit}{entry.quantity !== 1 ? "s" : ""}</p></div><div className="text-right"><strong className="block font-display text-xl font-normal">{caloriesFor(entry, entry.quantity)}</strong><span className="text-[9px] text-ink/40">kcal</span></div><button onClick={() => setLogs((current) => current.filter((item) => item.logId !== entry.logId))} className="grid size-8 place-items-center rounded-lg text-ink/35 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${entry.name}`}>{icons.trash}</button>
            </article>)}
          </div>
        </section>

        <aside className="hidden content-start gap-4 lg:grid">
          <article className="rounded-3xl border border-ink/10 bg-white p-5">
            <div className="mb-6 grid size-10 place-items-center rounded-xl bg-[#e4efd8]">{icons.scale}</div><p className="text-[10px] font-black uppercase tracking-[.15em] text-ink/45">Latest weight</p><h2 className="mt-1 font-display text-4xl font-normal tracking-[-.04em]">{latestWeight ? latestWeight.value : "—"}<span className="text-sm">{latestWeight ? " lb" : ""}</span></h2><p className="mt-1 text-[10px] text-ink/40">{latestWeight ? new Date(`${latestWeight.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "No entries yet"}</p>
            <button onClick={() => setSheet("weight")} className="mt-6 flex w-full justify-between border-t border-ink/10 pt-4 text-xs font-bold"><span>Log weight</span><span>＋</span></button>
          </article>
          <article className="rounded-3xl bg-[#dde8d2] p-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-ink/45">Quick add</p><h3 className="mt-1 font-display text-2xl">Your regulars</h3><div className="mt-4 grid gap-1">{foods.slice(0, 3).map((food) => <button key={food.id} onClick={() => openFood(food)} className="flex items-center gap-2.5 border-b border-ink/10 py-3 text-left"><span className="text-xl">{food.emoji}</span><span className="min-w-0 flex-1"><b className="block truncate text-[11px]">{food.name}</b><small className="text-[9px] text-ink/45">{food.calories} kcal / {perLabel(food)}</small></span><span>＋</span></button>)}</div><button onClick={() => setTab("inventory")} className="mt-4 flex w-full justify-between text-[10px] font-black uppercase tracking-wider"><span>All foods</span><span>→</span></button></article>
        </aside>
      </div>}

      {tab === "inventory" && <section>
        <div className="mb-5 flex gap-2.5"><label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white px-4 text-ink/40">{icons.search}<input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" placeholder="Search your foods" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button aria-label="New food" onClick={() => setSheet("new-food")} className="flex items-center gap-2 rounded-2xl bg-ink px-4 text-xs font-bold text-white">{icons.plus}<span className="hidden sm:inline">New food</span></button></div>
        <div className="grid gap-2.5 lg:grid-cols-2">{shownFoods.map((food) => <article key={food.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3"><button onClick={() => openFood(food)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0f3eb] text-2xl">{food.emoji}</span><span className="min-w-0"><strong className="block truncate text-sm">{food.name}</strong><small className="mt-1 block text-[10px] text-ink/45">{food.calories} calories per {perLabel(food)}</small></span></button><button onClick={() => setFoods((current) => current.filter((item) => item.id !== food.id))} className="grid size-8 place-items-center rounded-lg text-ink/30 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${food.name}`}>{icons.trash}</button></article>)}</div>
      </section>}

      {tab === "progress" && <section>
        <article className="flex flex-col gap-6 rounded-[26px] bg-ink p-6 text-white sm:flex-row sm:items-end sm:justify-between sm:p-8"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/50">Current weight</p><h2 className="mt-1 font-display text-6xl font-normal tracking-[-.05em]">{latestWeight ? latestWeight.value : "—"}<span className="text-lg">{latestWeight ? " lb" : ""}</span></h2><p className="mt-2 text-[10px] text-white/45">{weights.length} check-in{weights.length === 1 ? "" : "s"} · Keep showing up.</p></div><button onClick={() => setSheet("weight")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-acid px-4 text-xs font-black text-ink">{icons.plus} Log weight</button></article>
        <SectionTitle eyebrow="Your trend" title="Weight check-ins" />
        <div className="grid gap-2.5">{weights.length === 0 ? <div className="rounded-3xl border border-dashed border-ink/20 bg-white/70 px-6 py-16 text-center text-sm text-ink/45">Your first check-in starts the story.</div> : [...weights].sort((a, b) => b.date.localeCompare(a.date)).map((entry, index, sorted) => <article key={entry.id} className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4"><span className="flex-1 text-xs text-ink/55">{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span><strong className="font-display text-xl font-normal">{entry.value} lb</strong><small className="w-16 text-right text-[10px] text-ink/40">{index < sorted.length - 1 ? `${entry.value - sorted[index + 1].value > 0 ? "+" : ""}${(entry.value - sorted[index + 1].value).toFixed(1)} lb` : "First entry"}</small><button onClick={() => setWeights((current) => current.filter((item) => item.id !== entry.id))} className="text-ink/30">{icons.trash}</button></article>)}</div>
      </section>}
    </div>

    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-20 grid-cols-3 border-t border-ink/10 bg-[#fafff7]/90 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Main navigation">
      {(["today", "inventory", "progress"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`flex flex-col items-center justify-center gap-1 text-[9px] font-bold capitalize ${tab === item ? "text-ink" : "text-ink/40"}`}><span className={tab === item ? "rounded-xl bg-[#e4efd8] px-3 py-1" : "px-3 py-1"}>{item === "today" ? icons.home : item === "inventory" ? icons.box : icons.chart}</span>{item}</button>)}
    </nav>

    {sheet && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b1b13]/60 pt-10 backdrop-blur-sm md:items-center md:p-8" onMouseDown={(event) => { if (event.currentTarget === event.target && sheet !== "username") setSheet(null); }}>
      <section role="dialog" aria-modal="true" className="sheet-enter hide-scrollbar relative max-h-[calc(100dvh-28px)] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#f8faf5] px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-9 shadow-2xl md:max-h-[calc(100dvh-64px)] md:rounded-[28px] md:p-9">
        <div className="absolute left-1/2 top-2.5 h-1 w-11 -translate-x-1/2 rounded-full bg-ink/15 md:hidden" />{(sheet !== "username" || username) && <button onClick={() => setSheet(null)} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-ink/5" aria-label="Close">{icons.close}</button>}
        {sheet === "food" && <div><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-ink/45">Add to {dateName}</p><h2 className="mb-6 pr-12 font-display text-3xl tracking-[-.04em]">{selected ? selected.name : "What did you eat?"}</h2>
          {!selected ? <><label className="mb-3 flex h-12 items-center gap-2.5 rounded-2xl border border-ink/10 bg-white px-4 text-ink/35">{icons.search}<input autoFocus className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" /></label><div className="grid gap-2">{shownFoods.map((food) => <button key={food.id} onClick={() => { setSelected(food); setQuantity(food.amount); }} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 text-left"><span className="grid size-11 place-items-center rounded-xl bg-[#f0f3eb] text-2xl">{food.emoji}</span><span className="flex-1"><strong className="block text-sm">{food.name}</strong><small className="text-[10px] text-ink/40">{food.calories} kcal per {perLabel(food)}</small></span>{icons.chevron}</button>)}</div></> : <div className="grid gap-5"><div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3"><span className="grid size-14 place-items-center rounded-2xl bg-[#f0f3eb] text-3xl">{selected.emoji}</span><span><b className="block text-sm">{selected.calories} calories</b><small className="text-[10px] text-ink/40">per {perLabel(selected)}</small></span></div><label><span className={label}>How much?</span><div className="flex h-15 items-center rounded-2xl border border-ink/15 bg-white px-4"><input className="min-w-0 flex-1 bg-transparent font-display text-3xl outline-none" type="number" min="0.01" step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><span className="text-xs text-ink/45">{selected.unit}{quantity !== 1 ? "s" : ""}</span></div></label><div className="flex justify-between border-t border-ink/10 pt-4 text-sm"><span>Total</span><strong className="font-display text-xl font-normal">{caloriesFor(selected, quantity)} kcal</strong></div><button onClick={addToLog} className="h-13 rounded-2xl bg-ink text-sm font-black text-white">Add to day</button><button onClick={() => setSelected(null)} className="text-xs font-bold text-ink/55">Choose a different food</button></div>}
        </div>}
        {sheet === "new-food" && <form onSubmit={addFood}><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-ink/45">Stock your shortcuts</p><h2 className="mb-6 font-display text-3xl tracking-[-.04em]">Add an inventory item</h2><div className="grid gap-4"><div className="grid grid-cols-[76px_1fr] gap-3"><label><span className={label}>Emoji</span><input name="emoji" defaultValue="🥡" maxLength={4} className={`${input} text-center text-xl`} /></label><label><span className={label}>Food name</span><input name="name" placeholder="Greek yogurt" className={input} required /></label></div><div className="grid grid-cols-2 gap-3"><label><span className={label}>Calories</span><input name="calories" type="number" min="1" placeholder="120" className={input} required /></label><label><span className={label}>Per amount</span><input name="amount" type="number" min="0.01" step="any" defaultValue="1" className={input} required /></label></div><label><span className={label}>Unit</span><select name="unit" className={input} defaultValue="piece"><option value="piece">Piece</option><option value="gram">Gram</option><option value="ounce">Ounce</option><option value="pound">Pound</option><option value="cup">Cup</option><option value="serving">Serving</option></select></label><button type="submit" className="mt-2 h-13 rounded-2xl bg-ink text-sm font-black text-white">Save to inventory</button></div></form>}
        {sheet === "weight" && <form onSubmit={addWeight}><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-ink/45">Keep the signal</p><h2 className="mb-6 font-display text-3xl tracking-[-.04em]">Log your weight</h2><div className="grid gap-4"><label><span className={label}>Weight (lb)</span><input autoFocus name="weight" type="number" min="1" step="0.1" placeholder={latestWeight ? String(latestWeight.value) : "165.0"} className={`${input} font-display text-2xl`} required /></label><label><span className={label}>Date</span><input name="date" type="date" defaultValue={localDate()} max={localDate()} className={input} required /></label><button type="submit" className="mt-2 h-13 rounded-2xl bg-ink text-sm font-black text-white">Save check-in</button></div></form>}
        {sheet === "username" && <form onSubmit={chooseUsername}><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-ink/45">Your tracker, everywhere</p><h2 className="mb-3 font-display text-3xl tracking-[-.04em]">What&apos;s your username?</h2><p className="mb-6 text-sm leading-6 text-ink/55">Enter an existing username to load it, or choose a new one to start fresh. We&apos;ll remember it on this device.</p><label><span className={label}>Username</span><div className="flex h-14 items-center rounded-2xl border border-ink/15 bg-white px-4 focus-within:border-moss focus-within:ring-4 focus-within:ring-moss/10"><span className="text-ink/35">@</span><input autoFocus name="username" defaultValue={username} className="min-w-0 flex-1 bg-transparent px-1 text-base font-bold lowercase outline-none" placeholder="yourname" autoComplete="username" /></div></label>{usernameError && <p className="mt-2 text-xs font-bold text-red-700">{usernameError}</p>}<button type="submit" className="mt-5 h-13 w-full rounded-2xl bg-ink text-sm font-black text-white">Open my tracker</button><p className="mt-4 text-center text-[10px] leading-4 text-ink/40">No password: anyone who knows this username can access its data.</p></form>}
      </section>
    </div>}
  </main>;
}

function RailButton({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: ReactNode }) {
  return <button title={title} aria-label={title} onClick={onClick} className={`grid size-11 place-items-center rounded-xl transition ${active ? "bg-[#e4efd8] text-ink" : "text-ink/40 hover:bg-ink/5 hover:text-ink"}`}>{children}</button>;
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="mb-3.5 mt-8 flex items-end justify-between gap-4"><div><p className="mb-1 text-[10px] font-black uppercase tracking-[.16em] text-ink/45">{eyebrow}</p><h2 className="font-display text-[26px] leading-none tracking-[-.04em]">{title}</h2></div>{children}</div>;
}
