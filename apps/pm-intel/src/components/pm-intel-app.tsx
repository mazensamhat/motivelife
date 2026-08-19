"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountPanel } from "@/components/account-panel";
import { AskAiPanel } from "@/components/ask-ai-panel";
import { DirectorView } from "@/components/director-view";
import type { AssistantContext } from "@/lib/assistant";
import { slugPm, pillClass, tempClass } from "@/lib/format";
import { parseRecapFile } from "@/lib/parse-excel";
import {
  makeSamplePeerBook,
  normalizeRecaps,
  scoreBook,
  scorePm,
  scoreTeams,
  seedOrgFromFiles,
} from "@/lib/scoring";
import { clearImportedRecaps, loadImportedRecaps, saveImportedRecaps } from "@/lib/storage";
import type { RecapFile, StoreScore } from "@/lib/types";
import { DEFAULT_AS_OF } from "@/lib/types";

type View = "pm" | "director" | "import" | "model";

export function PmIntelApp() {
  const [seed, setSeed] = useState<RecapFile | null>(null);
  const [imported, setImported] = useState<RecapFile[]>([]);
  const [samplePeer, setSamplePeer] = useState<RecapFile | null>(null);
  const [view, setView] = useState<View>("pm");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [error, setError] = useState("");
  const [pmName, setPmName] = useState("");
  const [teamId, setTeamId] = useState("team-canada-b");

  useEffect(() => {
    fetch("/data/mazen-recap.json")
      .then((res) => res.json())
      .then((data: RecapFile) => {
        data.assignedPm.teamId = "team-canada-a";
        setSeed(data);
      })
      .catch(() => setError("Could not load Mazen’s recap seed."));
    setImported(loadImportedRecaps());
  }, []);

  const files = useMemo(() => {
    const all: RecapFile[] = [];
    if (seed) all.push(seed);
    all.push(...imported);
    if (samplePeer) all.push(samplePeer);
    return all;
  }, [seed, imported, samplePeer]);

  const org = useMemo(() => seedOrgFromFiles(files), [files]);
  const engagements = useMemo(() => normalizeRecaps(files), [files]);
  const stores = useMemo(() => scoreBook(engagements, DEFAULT_AS_OF), [engagements]);
  const pms = useMemo(
    () =>
      org.pms
        .map((pm) => scorePm(stores.filter((store) => store.pmId === pm.id), org))
        .filter((pm): pm is NonNullable<typeof pm> => Boolean(pm)),
    [org, stores],
  );
  const teams = useMemo(() => scoreTeams(pms, org), [pms, org]);
  const mazenStores = stores.filter((store) => store.pmId === (seed?.assignedPm.id || "pm-mazen-samhat"));
  const filtered = mazenStores.filter((store) => {
    const blob = `${store.storeName} ${store.dealerGroup || ""}`.toLowerCase();
    return (!query || blob.includes(query.toLowerCase())) && (!health || store.label === health);
  });
  const selected: StoreScore | null =
    filtered.find((store) => store.storeKey === selectedKey) || filtered[0] || null;

  const ctx: AssistantContext = { org, engagements, stores, pms, teams, asOf: DEFAULT_AS_OF };

  async function onImport(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError("");
    try {
      const name = pmName.trim() || file.name.replace(/\.[^.]+$/, "");
      const recap = await parseRecapFile(file, {
        assignedPmId: slugPm(name),
        assignedPmName: name,
        teamId,
        region: "Canada",
      });
      if (!recap.records.length) throw new Error("No activity rows found in that workbook.");
      const next = [...imported.filter((item) => item.assignedPm.id !== recap.assignedPm.id), recap];
      setImported(next);
      saveImportedRecaps(next);
      setView("director");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that recap.");
    }
  }

  if (!seed) {
    return <div className="p-10 text-muted">Loading Mazen’s dealer recap…</div>;
  }

  const mazenPm = pms.find((pm) => pm.pmId === seed.assignedPm.id);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
      <header className="grid gap-6 rounded-[32px] border border-line bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,.08)] lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-blue">PM Intelligence</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Dealer engagement, scored without punishing the past
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted lg:text-base">
            Local assistant for performance managers. Last visit, temperature, cadence, store score, PM score, then a
            director view of team versus team. Blank Salesforce comments before March 2026 are treated as{" "}
            <strong className="text-navy">unknown, not bad</strong>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-ice px-3 py-1 text-navy">{seed.records.length} Mazen records</span>
            <span className="rounded-full bg-ice px-3 py-1 text-navy">{mazenStores.length} rooftops</span>
            <span className="rounded-full bg-ice px-3 py-1 text-navy">As of {DEFAULT_AS_OF}</span>
            <span className="rounded-full bg-amber/15 px-3 py-1 text-hot">Runs in the browser</span>
          </div>
        </div>
        <div className="rounded-3xl bg-navy p-5 text-ice">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan">This book</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">{seed.assignedPm.name}</p>
          <p className="text-sm text-ice/80">{seed.sourceFile}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ice/60">PM score</dt>
              <dd className="text-2xl font-bold">{mazenPm?.score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ice/60">At risk</dt>
              <dd className="text-2xl font-bold">{mazenPm?.atRisk ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ice/60">90-day coverage</dt>
              <dd className="text-2xl font-bold">{mazenPm?.coverage90 ?? "—"}%</dd>
            </div>
            <div>
              <dt className="text-ice/60">Notes after Mar 2026</dt>
              <dd className="text-2xl font-bold">{mazenPm?.noteCaptureAfterCutoff ?? "—"}%</dd>
            </div>
          </dl>
        </div>
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["pm", "PM command"],
            ["director", "Director"],
            ["import", "Import recap"],
            ["model", "How the model scores"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${view === id ? "bg-navy text-white" : "bg-white text-navy border border-line"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-red">{error}</p> : null}

      {view === "pm" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <aside className="rounded-3xl border border-line bg-white p-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter stores"
              className="h-10 w-full rounded-2xl border border-line bg-ice px-3 text-sm outline-none"
            />
            <select
              value={health}
              onChange={(event) => setHealth(event.target.value)}
              className="mt-2 h-10 w-full rounded-2xl border border-line bg-white px-3 text-sm"
            >
              <option value="">All health labels</option>
              <option>Healthy</option>
              <option>Watch</option>
              <option>At Risk</option>
            </select>
            <div className="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1">
              {filtered.map((store) => (
                <button
                  key={store.storeKey}
                  type="button"
                  onClick={() => setSelectedKey(store.storeKey)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left ${selected?.storeKey === store.storeKey ? "border-blue bg-ice" : "border-line bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-navy">{store.storeName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pillClass(store.label)}`}>
                      {store.score}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span>Last {store.lastEngagement.date || "—"}</span>
                    <span className={`rounded-full px-2 py-0.5 ${tempClass(store.temperature.label)}`}>
                      {store.temperature.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <AccountPanel store={selected} />
          <AskAiPanel ctx={ctx} />
        </div>
      ) : null}

      {view === "director" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <DirectorView
            teams={teams}
            pms={pms}
            sampleLoaded={Boolean(samplePeer)}
            onLoadSamplePeer={() => setSamplePeer(makeSamplePeerBook(seed.records))}
          />
          <AskAiPanel ctx={ctx} />
        </div>
      ) : null}

      {view === "import" ? (
        <section className="mt-5 rounded-3xl border border-line bg-white p-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-navy">
            Import another PM recap
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Drop a Salesforce activity export like <code>Mazen PM Dealer Recap-*.xlsx</code>. Assign it to a PM and a
            director team. Files stay in this browser until you clear them.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm">
              Performance manager name
              <input
                value={pmName}
                onChange={(event) => setPmName(event.target.value)}
                placeholder="e.g. Jordan Lee"
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3"
              />
            </label>
            <label className="text-sm">
              Team
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3"
              >
                <option value="team-canada-a">Team Canada A (Mazen)</option>
                <option value="team-canada-b">Team Canada B (peer team)</option>
              </select>
            </label>
            <label className="text-sm">
              Excel recap
              <input
                type="file"
                accept=".xlsx,.xls"
                className="mt-1 block w-full text-sm"
                onChange={(event) => onImport(event.target.files)}
              />
            </label>
          </div>
          <div className="mt-6">
            <h3 className="font-semibold text-navy">Loaded recaps</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {files.map((file) => (
                <li key={file.assignedPm.id} className="rounded-2xl bg-ice px-3 py-2">
                  {file.assignedPm.name} · {file.records.length} rows · {file.sourceFile}
                </li>
              ))}
            </ul>
            {imported.length ? (
              <button
                type="button"
                className="mt-4 text-sm text-red"
                onClick={() => {
                  clearImportedRecaps();
                  setImported([]);
                }}
              >
                Clear imported recaps
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "model" ? <ModelCard storeCount={mazenStores.length} /> : null}
    </div>
  );
}

function ModelCard({ storeCount }: { storeCount: number }) {
  return (
    <section className="mt-5 grid gap-4 rounded-3xl border border-line bg-white p-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-navy">
        Local model — what it actually does
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-muted">
        This is not a hosted chatbot. The “model” is a local engagement intelligence engine: it resolves rooftops,
        scores cadence and type, reads Customer Impression when present, and answers questions with citations from the
        recap sitting in this browser. {storeCount} rooftops in Mazen’s current book.
      </p>
      <ol className="grid gap-3 text-sm leading-6 text-navy-2 md:grid-cols-2">
        <li className="rounded-2xl bg-ice p-4">
          <strong>1. Missing notes ≠ bad visit.</strong> Customer Impression only appears from March 2026. Earlier
          Salesforce rows with “No comments captured” are labeled legacy / unscored and are excluded from temperature.
        </li>
        <li className="rounded-2xl bg-ice p-4">
          <strong>2. Type matters.</strong> QBR (1.0), Risk save (0.95), Performance Review (0.85), follow-up (0.70),
          general (0.45), unspecified (0.35). Automated recap rows still count as completed activity.
        </li>
        <li className="rounded-2xl bg-ice p-4">
          <strong>3. Cadence + recency.</strong> Target is about one structured touch per month. Health is recency,
          90/180-day frequency, and type mix. Temperature is a fourth slice only when notes exist.
        </li>
        <li className="rounded-2xl bg-ice p-4">
          <strong>4. Store, PM, director.</strong> Stores roll to the PM. PMs roll to a team. The director compares Team
          Canada A vs B once more recaps are imported.
        </li>
      </ol>
    </section>
  );
}
