"use client";



import { Download } from "lucide-react";

import type { LifeGraphPayload } from "@forward/shared";



export function LifeGraphSnippet({ graph }: { graph: LifeGraphPayload }) {

  if (graph.edges.length === 0 && !graph.destination) return null;



  const edgeLabels = graph.edges.slice(0, 4).map((e) => {

    const from = graph.nodes.find((n) => n.type === e.fromType && n.id === e.fromId);

    const to = graph.nodes.find((n) => n.type === e.toType && n.id === e.toId);

    return {

      id: e.id,

      text: `${from?.label ?? e.fromId} → ${to?.label ?? e.toId}`,

      relation: e.relation,

    };

  });



  return (

    <section className="rounded-2xl border border-forward-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between gap-3">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-forward-400">

            Life Graph™

          </p>

          <p className="mt-1 text-sm text-forward-500">

            How your goals, money, and destination connect.

          </p>

        </div>

        <a

          href="/api/life-graph/export"

          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-forward-200 bg-forward-50 px-2.5 py-1.5 text-xs font-medium text-forward-700 hover:bg-forward-100"

          download

        >

          <Download className="h-3.5 w-3.5" />

          Export

        </a>

      </div>

      {graph.destination && (

        <p className="mt-3 text-sm font-medium text-forward-900">

          Destination: {graph.destination.label}

        </p>

      )}

      {edgeLabels.length > 0 && (

        <ul className="mt-3 space-y-2">

          {edgeLabels.map((e) => (

            <li

              key={e.id}

              className="rounded-lg border border-forward-100 bg-forward-50/60 px-3 py-2 text-xs text-forward-700"

            >

              <span className="font-medium">{e.text}</span>

              <span className="ml-2 text-forward-400">{e.relation.toLowerCase()}</span>

            </li>

          ))}

        </ul>

      )}

      <p className="mt-3 text-[10px] text-forward-400">

        Your data is yours — JSON export includes graph, moments, and beliefs.

      </p>

    </section>

  );

}


