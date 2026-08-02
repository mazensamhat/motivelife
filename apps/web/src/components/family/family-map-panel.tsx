"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOCATION_SHARING_LABELS,
  LOCATION_SHARING_LEVELS,
  type FamilyMapState,
  type LocationSharingLevel,
} from "@forward/shared";
import { Button, buttonClassName } from "@/components/button";
import { useFamilyLocationShare } from "@/hooks/use-family-location-share";

const FamilyLeafletMap = dynamic(() => import("@/components/family/family-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[22rem] items-center justify-center rounded-2xl border border-forward-200 bg-forward-950 text-sm text-forward-300">
      Loading Intelligent Family Map…
    </div>
  ),
});

async function readError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function FamilyMapPanel() {
  const [state, setState] = useState<FamilyMapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareLive, setShareLive] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [placeName, setPlaceName] = useState("Home");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/family/map");
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const data = (await res.json()) as FamilyMapState;
    setState(data);
    setError(null);
    if (!selectedId && data.members[0]) setSelectedId(data.members[0].id);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  const { sharing, error: shareError, lastFixAt } = useFamilyLocationShare({
    enabled: shareLive && !!state,
    onState: setState,
  });

  const selected = useMemo(
    () => state?.members.find((m) => m.id === selectedId) ?? state?.members[0] ?? null,
    [selectedId, state]
  );

  async function seedDemo() {
    setBusy(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation unavailable"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20_000,
        });
      });
      const res = await fetch("/api/family/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
      setShareLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not seed demo family.");
    } finally {
      setBusy(false);
    }
  }

  async function joinFamily() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
      setJoinCode("");
    } finally {
      setBusy(false);
    }
  }

  async function savePlaceHere() {
    if (!navigator.geolocation) {
      setError("Geolocation unavailable.");
      return;
    }
    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20_000,
        });
      });
      const res = await fetch("/api/family/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: placeName.trim() || "Place",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          category: placeName.trim().toLowerCase() === "home" ? "home" : "other",
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save place.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePrivacy(level: LocationSharingLevel) {
    setBusy(true);
    try {
      const res = await fetch("/api/family/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationSharingLevel: level }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setState((await res.json()) as FamilyMapState);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !state) {
    return (
      <div className="rounded-2xl border border-forward-200 bg-white p-8 text-sm text-forward-500">
        Opening your Family command center…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Could not load Family Map."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || shareError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error || shareError}
        </div>
      )}

      {/* Family Now strip */}
      <section className="rounded-2xl border border-forward-800 bg-forward-950 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
              Your family — now
            </p>
            <p className="mt-2 font-display text-xl font-semibold">
              {state.flow.everyoneHomeByLabel ?? "Building Family Flow…"}
            </p>
          </div>
          <div className="text-right text-xs text-forward-400">
            <p>
              Invite code{" "}
              <span className="font-mono text-sm font-semibold text-white">
                {state.household.inviteCode}
              </span>
            </p>
            <p className="mt-1">
              {state.household.memberCount}/{state.household.maxMembers} members
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {state.members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition ${
                  selected?.id === m.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-forward-950"
                  style={{ background: m.color }}
                >
                  {m.displayName.slice(0, 1)}
                </span>
                <span>
                  <span className="font-semibold text-white">
                    {m.displayName}
                    {m.isYou ? " (you)" : ""}
                    {m.isSimulated ? " · demo" : ""}
                  </span>
                  <span className="text-forward-300"> — {m.statusLabel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {state.flow.conflictNote ? (
          <p className="mt-4 border-t border-white/10 pt-3 text-sm text-brand-yellow">
            ⚠ {state.flow.conflictNote}
          </p>
        ) : null}
        {state.flow.opportunityNote ? (
          <p className="mt-2 text-sm text-brand-cyan">💡 {state.flow.opportunityNote}</p>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="min-h-[24rem]">
          <FamilyLeafletMap
            members={state.members}
            places={state.places}
            selectedMemberId={selected?.id ?? null}
            onSelectMember={setSelectedId}
          />
        </div>

        <aside className="space-y-4">
          {selected ? (
            <section className="rounded-2xl border border-forward-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
                Member detail
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-forward-900">
                {selected.displayName}
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-forward-500">Status</dt>
                  <dd className="font-medium text-forward-900">{selected.presence}</dd>
                </div>
                <div>
                  <dt className="text-forward-500">Speed</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.speedKmh != null ? `${Math.round(selected.speedKmh)} km/h` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-forward-500">Destination</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.likelyDestination ?? "—"}
                    {selected.destinationConfidence != null
                      ? ` (${Math.round(selected.destinationConfidence * 100)}%)`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-forward-500">ETA</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.etaMinutes != null ? `${selected.etaMinutes} min` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-forward-500">Battery</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.batteryPercent != null ? `${selected.batteryPercent}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-forward-500">Drive score</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.driveScoreRecent != null ? `${selected.driveScoreRecent}/100` : "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-forward-500">Place</dt>
                  <dd className="font-medium text-forward-900">
                    {selected.placeName ?? "—"}
                    {selected.timeAtPlaceMinutes != null
                      ? ` · ${selected.timeAtPlaceMinutes} min`
                      : ""}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          {state.somethingDifferent ? (
            <section className="rounded-2xl border border-brand-orange/40 bg-orange-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
                {state.somethingDifferent.title}
              </p>
              <p className="mt-2 text-sm text-forward-800">{state.somethingDifferent.body}</p>
              <p className="mt-2 text-xs font-medium text-forward-600">
                {state.somethingDifferent.tone}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Message", "Call", "Navigate"].map((action) => (
                  <span
                    key={action}
                    className="rounded-lg border border-forward-300 bg-white px-3 py-1.5 text-xs font-semibold text-forward-800"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-forward-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-forward-500">
              Live location
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-forward-800">
              <input
                type="checkbox"
                checked={shareLive}
                onChange={(e) => setShareLive(e.target.checked)}
              />
              Share my live location with my family
            </label>
            <p className="mt-2 text-xs text-forward-500">
              {sharing
                ? `Sharing active${lastFixAt ? ` · last fix ${new Date(lastFixAt).toLocaleTimeString()}` : ""}`
                : "Location sharing paused"}
            </p>
            <label className="mt-4 block text-xs font-medium text-forward-600">
              My sharing level
              <select
                className="mt-1 w-full rounded-lg border border-forward-200 px-3 py-2 text-sm"
                value={state.you.locationSharingLevel}
                onChange={(e) => updatePrivacy(e.target.value as LocationSharingLevel)}
                disabled={busy}
              >
                {LOCATION_SHARING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LOCATION_SHARING_LABELS[level]}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-forward-200 bg-white p-5">
          <h3 className="font-display text-lg font-semibold text-forward-900">Places</h3>
          <ul className="mt-3 space-y-2 text-sm text-forward-700">
            {state.places.length === 0 ? (
              <li className="text-forward-500">No places yet — save Home below.</li>
            ) : (
              state.places.map((p) => (
                <li key={p.id}>
                  <span className="font-medium text-forward-900">{p.name}</span>
                  {" · "}
                  {p.visitCount} visits
                  {p.membersHeadingThere > 0 ? ` · ${p.membersHeadingThere} heading there` : ""}
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 flex gap-2">
            <input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              className="flex-1 rounded-lg border border-forward-200 px-3 py-2 text-sm"
              placeholder="Place name"
            />
            <Button type="button" onClick={() => void savePlaceHere()} disabled={busy}>
              Save here
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-forward-200 bg-white p-5">
          <h3 className="font-display text-lg font-semibold text-forward-900">Drive Score</h3>
          {state.recentTrips.length === 0 ? (
            <p className="mt-3 text-sm text-forward-500">
              Trips appear when someone drives. Share live location on the move to build Drive Score.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {state.recentTrips.slice(0, 4).map((trip, idx) => (
                <li key={`${trip.fromLabel}-${trip.toLabel}-${idx}`} className="text-sm">
                  <p className="font-medium text-forward-900">
                    {trip.fromLabel} → {trip.toLabel}
                  </p>
                  <p className="text-forward-600">
                    {trip.distanceKm} km · {trip.durationMinutes} min · Score{" "}
                    <span className="font-semibold text-forward-900">{trip.driveScore}</span> (
                    {trip.band})
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-forward-200 bg-white p-5">
          <h3 className="font-display text-lg font-semibold text-forward-900">Household</h3>
          <p className="mt-2 text-sm text-forward-600">
            Share your invite code so family members can join. Or load a local demo family near you
            to see Family Flow immediately.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-forward-200 px-3 py-2 font-mono text-sm uppercase"
              placeholder="Invite code"
              maxLength={12}
            />
            <Button type="button" onClick={() => void joinFamily()} disabled={busy || !joinCode}>
              Join
            </Button>
          </div>
          {state.household.isOwner ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void seedDemo()}
              className={buttonClassName({
                variant: "secondary",
                className: "mt-3 w-full",
              })}
            >
              {busy ? "Working…" : "Load demo family near me"}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
