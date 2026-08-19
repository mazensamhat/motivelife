"use client";

import { pillClass } from "@/lib/format";
import type { PmScore, TeamScore } from "@/lib/types";

export function DirectorView({
  teams,
  pms,
  onLoadSamplePeer,
  sampleLoaded,
}: {
  teams: TeamScore[];
  pms: PmScore[];
  onLoadSamplePeer: () => void;
  sampleLoaded: boolean;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-line bg-white p-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber">Director</p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-navy">Team versus team</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          Each performance manager imports their Salesforce recap. The director sees coverage, store health, and
          at-risk rooftops without mixing one PM’s personal book into another. Legacy blank comments still do not
          count as bad visits.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLoadSamplePeer}
            disabled={sampleLoaded}
            className="rounded-2xl bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sampleLoaded ? "Illustration peer loaded" : "Load illustration peer team"}
          </button>
          <p className="self-center text-xs text-muted">
            Illustration data is labeled SAMPLE. Replace it by importing a real recap onto Team Canada B.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <article key={team.teamId} className="rounded-3xl border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-navy">{team.teamName}</h3>
                <p className="text-sm text-muted">{team.directorName}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${pillClass(team.label)}`}>
                {team.pms.length ? `${team.score} ${team.label}` : "No recap"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">PMs</dt>
                <dd className="text-lg font-bold text-navy">{team.pms.length}</dd>
              </div>
              <div>
                <dt className="text-muted">Stores</dt>
                <dd className="text-lg font-bold text-navy">{team.storeCount}</dd>
              </div>
              <div>
                <dt className="text-muted">90-day coverage</dt>
                <dd className="text-lg font-bold text-navy">{team.coverage90}%</dd>
              </div>
              <div>
                <dt className="text-muted">At risk</dt>
                <dd className="text-lg font-bold text-red">{team.atRisk}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-2">
              {team.pms.length ? (
                team.pms.map((pm) => (
                  <li key={pm.pmId} className="flex items-center justify-between rounded-2xl bg-ice px-3 py-2 text-sm">
                    <span className="font-semibold text-navy">{pm.pmName}</span>
                    <span>
                      {pm.score} · {pm.atRisk} at risk
                    </span>
                  </li>
                ))
              ) : (
                <li className="rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-muted">
                  Import a PM recap and assign it to this team to populate the comparison.
                </li>
              )}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-white p-5">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-navy">PM leaderboard</h3>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2">PM</th>
                <th>Team</th>
                <th>Score</th>
                <th>Stores</th>
                <th>Coverage 90</th>
                <th>At risk</th>
                <th>Notes after Mar 2026</th>
              </tr>
            </thead>
            <tbody>
              {pms.map((pm) => (
                <tr key={pm.pmId} className="border-t border-line">
                  <td className="py-3 font-semibold text-navy">{pm.pmName}</td>
                  <td>{pm.teamName}</td>
                  <td>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${pillClass(pm.label)}`}>
                      {pm.score} {pm.label}
                    </span>
                  </td>
                  <td>{pm.storeCount}</td>
                  <td>{pm.coverage90}%</td>
                  <td>{pm.atRisk}</td>
                  <td>{pm.noteCaptureAfterCutoff}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
