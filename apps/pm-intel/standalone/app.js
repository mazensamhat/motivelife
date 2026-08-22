(function () {
  var E = window.PMIntel;
  var state = {
    seed: null,
    sample: null,
    view: "pm",
    query: "",
    health: "",
    selectedKey: "",
    answers: [],
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pillHealth(label) {
    return "pill health-" + String(label).replace(/\s+/g, "-");
  }
  function pillTemp(label) {
    var known = { Hot: 1, Warm: 1, Mixed: 1, Cool: 1, Cold: 1 };
    return "pill " + (known[label] ? "temp-" + label : "temp-unknown");
  }
  function files() {
    var all = [];
    if (state.seed) all.push(state.seed);
    if (state.sample) all.push(state.sample);
    return all;
  }
  function model() {
    var list = files();
    var org = E.seedOrgFromFiles(list);
    var engagements = E.normalizeRecaps(list);
    var stores = E.scoreBook(engagements, E.DEFAULT_AS_OF);
    var pms = org.pms.map(function (pm) {
      return E.scorePm(stores.filter(function (store) { return store.pmId === pm.id; }), org);
    }).filter(Boolean);
    var teams = E.scoreTeams(pms, org);
    var mazenStores = stores.filter(function (store) { return store.pmId === state.seed.assignedPm.id; });
    var filtered = mazenStores.filter(function (store) {
      var blob = (store.storeName + " " + (store.dealerGroup || "")).toLowerCase();
      return (!state.query || blob.indexOf(state.query.toLowerCase()) >= 0) && (!state.health || store.label === state.health);
    });
    var selected = filtered.filter(function (store) { return store.storeKey === state.selectedKey; })[0] || filtered[0] || null;
    return { org: org, engagements: engagements, stores: stores, pms: pms, teams: teams, mazenStores: mazenStores, filtered: filtered, selected: selected };
  }

  function renderAsk(m) {
    var starters = E.STARTERS.map(function (q) {
      return '<button class="ask-btn" data-q="' + esc(q) + '">' + esc(q) + "</button>";
    }).join("");
    var body = state.answers.length
      ? state.answers.map(function (item) {
          return '<article class="msg"><div class="muted">' + esc(item.intent.replace(/_/g, " ")) + "</div><strong>" + esc(item.question) + '</strong><h3>' + esc(item.headline) + "</h3><p>" + esc(item.answer) + "</p><ul>" + item.bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" + (item.citations || []).map(function (c) { return '<span class="badge">' + esc(c.storeName || "") + (c.date ? " · " + c.date : "") + "</span>"; }).join(" ") + '<div>' + (item.suggestedFollowups || []).map(function (q) { return '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + "</button>"; }).join("") + "</div></article>";
        }).join("")
      : starters;
    return '<section class="card ask"><div><div class="eyebrow">Local model</div><h2>Ask the book</h2><p class="muted">Runs in this HTML file. Dealer recaps never leave your computer.</p></div><div class="ask-body" id="askBody">' + body + '</div><form class="ask-form" id="askForm"><input id="askQ" placeholder="Ask: last visit, temperature, who to call…"><button class="primary" type="submit">Ask</button></form></section>';
  }

  function renderAccount(store) {
    if (!store) return '<section class="card">Select a store.</section>';
    var b = store.breakdown;
    var bars = [
      ["Recency", b.recency.points, b.recency.max, false],
      ["Cadence", b.cadence.points, b.cadence.max, false],
      ["Type mix", b.mix.points, b.mix.max, false],
      ["Temperature", b.temperature.applied ? b.temperature.points || 0 : 0, b.temperature.max, !b.temperature.applied],
    ].map(function (row) {
      var pct = row[3] ? 0 : Math.round((row[1] / Math.max(row[2], 1)) * 100);
      return '<div class="metric"><small>' + row[0] + "</small><b>" + (row[3] ? "excluded" : row[1] + "/" + row[2]) + '</b><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join("");
    var timeline = store.engagements.slice(0, 40).map(function (row) {
      return '<div class="tl"><div class="row"><strong>' + esc(row.date) + "</strong><span class='muted'>" + esc(row.activityType) + " · " + esc(row.createdBy) + "</span></div><div>" + esc(row.subject) + '</div><span class="' + pillTemp(row.temperature.label) + '">' + esc(row.temperature.label) + "</span>" + (row.temperature.impression ? "<p class='muted'>" + esc(row.temperature.impression) + "</p>" : "") + "</div>";
    }).join("");
    return '<section class="card"><div class="row"><div><div class="eyebrow">Account 360</div><h2>' + esc(store.storeName) + '</h2><p class="muted">' + esc(store.dealerGroup || "Independent rooftop") + " · PM " + esc(store.pmName) + '</p></div><div><span class="' + pillHealth(store.label) + '">' + esc(store.label) + " " + store.score + '</span> <span class="' + pillTemp(store.temperature.label) + '">' + esc(store.temperature.label) + "</span></div></div><p class='action'>" + esc(store.nextAction) + '</p><div class="grid4"><div class="metric"><small>Last engagement</small><b>' + esc(store.lastEngagement.date || "—") + "</b><span class='muted'>" + esc(store.lastEngagement.type || "") + '</span></div><div class="metric"><small>Days since</small><b>' + esc(store.lastEngagement.daysSince) + "</b></div><div class='metric'><small>90-day visits</small><b>" + store.counts.last90 + "</b><span class='muted'>Target 3</span></div><div class='metric'><small>Scored impressions</small><b>" + store.temperature.readings + "</b><span class='muted'>Blanks before Mar 2026 ignored</span></div></div><div class='grid4'>" + bars + "</div><p class='muted'>" + esc(b.temperature.reason) + "</p><h3>Timeline</h3><div class='timeline'>" + timeline + "</div></section>";
  }

  function renderPm(m) {
    var list = m.filtered.map(function (store) {
      return '<button class="store-btn' + (m.selected && m.selected.storeKey === store.storeKey ? " on" : "") + '" data-store="' + esc(store.storeKey) + '"><div class="row"><strong>' + esc(store.storeName) + '</strong><span class="' + pillHealth(store.label) + '">' + store.score + '</span></div><div class="row muted"><span>Last ' + esc(store.lastEngagement.date || "—") + '</span><span class="' + pillTemp(store.temperature.label) + '">' + esc(store.temperature.label) + "</span></div></button>";
    }).join("");
    return '<div class="layout"><aside class="card"><input id="q" value="' + esc(state.query) + '" placeholder="Filter stores"><select id="health"><option value="">All health labels</option><option' + (state.health === "Healthy" ? " selected" : "") + ">Healthy</option><option" + (state.health === "Watch" ? " selected" : "") + ">Watch</option><option" + (state.health === "At Risk" ? " selected" : "") + ">At Risk</option></select><div class='list'>" + list + "</div></aside>" + renderAccount(m.selected) + renderAsk(m) + "</div>";
  }

  function renderDirector(m) {
    var teams = m.teams.map(function (team) {
      var members = team.pms.length
        ? team.pms.map(function (pm) { return '<li class="action"><strong>' + esc(pm.pmName) + "</strong> · " + pm.score + " · " + pm.atRisk + " at risk</li>"; }).join("")
        : '<li class="muted">Import or load illustration data for this team.</li>';
      return '<article class="card"><div class="row"><div><h3>' + esc(team.teamName) + '</h3><p class="muted">' + esc(team.directorName) + "</p></div><span class='" + pillHealth(team.pms.length ? team.label : "Watch") + "'>" + (team.pms.length ? team.score + " " + team.label : "No recap") + "</span></div><p>PMs <b>" + team.pms.length + "</b> · Stores <b>" + team.storeCount + "</b> · 90-day <b>" + team.coverage90 + "%</b> · At risk <b>" + team.atRisk + "</b></p><ul>" + members + "</ul></article>";
    }).join("");
    var rows = m.pms.map(function (pm) {
      return "<tr><td><strong>" + esc(pm.pmName) + "</strong></td><td>" + esc(pm.teamName) + '</td><td><span class="' + pillHealth(pm.label) + '">' + pm.score + " " + pm.label + "</span></td><td>" + pm.storeCount + "</td><td>" + pm.coverage90 + "%</td><td>" + pm.atRisk + "</td><td>" + pm.noteCaptureAfterCutoff + "%</td></tr>";
    }).join("");
    return '<div class="layout" style="grid-template-columns:minmax(0,1fr) 380px"><div><section class="card"><div class="eyebrow">Director</div><h2>Team versus team</h2><p class="muted">Each PM can live in this same HTML file. Load the illustration peer to see Team Canada B before a second live recap exists.</p><p><button class="primary" id="sampleBtn"' + (state.sample ? " disabled" : "") + ">" + (state.sample ? "Illustration peer loaded" : "Load illustration peer team") + "</button></p></section><div class='director'>" + teams + '</div><section class="card"><h3>PM leaderboard</h3><table><thead><tr><th>PM</th><th>Team</th><th>Score</th><th>Stores</th><th>Coverage 90</th><th>At risk</th><th>Notes after Mar 2026</th></tr></thead><tbody>' + rows + "</tbody></table></section></div>" + renderAsk(m) + "</div>";
  }

  function renderModel() {
    return '<section class="card"><h2>Local model — what it actually does</h2><p class="muted">This HTML file is the product. There is no localhost and no cloud LLM. Scoring, temperature, and answers all run in your browser.</p><div class="model-grid"><div><strong>1. Missing notes ≠ bad visit.</strong> Customer Impression only appears from March 2026. Earlier Salesforce rows with “No comments captured” are labeled legacy / unscored and are excluded from temperature.</div><div><strong>2. Type matters.</strong> QBR (1.0), Risk save (0.95), Performance Review (0.85), follow-up (0.70), general (0.45), unspecified (0.35).</div><div><strong>3. Cadence + recency.</strong> Target is about one structured touch per month. Temperature is a fourth slice only when notes exist.</div><div><strong>4. Store, PM, director.</strong> Stores roll to the PM. PMs roll to a team. The director compares Team Canada A vs B.</div></div></section>';
  }

  function render() {
    var m = model();
    var mazenPm = m.pms.filter(function (pm) { return pm.pmId === state.seed.assignedPm.id; })[0];
    var app = document.getElementById("app");
    app.innerHTML =
      '<header class="hero"><div><div class="eyebrow">PM Intelligence</div><h1>Dealer engagement, scored without punishing the past</h1><p class="sub">Double-click this HTML file. Last visit, temperature, cadence, store score, PM score, then a director view of team versus team. Blank Salesforce comments before March 2026 are treated as <strong>unknown, not bad</strong>.</p><div class="badges"><span class="badge">' + state.seed.records.length + ' Mazen records</span><span class="badge">' + m.mazenStores.length + ' rooftops</span><span class="badge">As of ' + E.DEFAULT_AS_OF + '</span><span class="badge warn">Single local HTML file</span></div></div><div class="book"><div class="k">This book</div><h2>' + esc(state.seed.assignedPm.name) + "</h2><p>" + esc(state.seed.sourceFile) + '</p><div class="stats"><div>PM score<strong>' + (mazenPm ? mazenPm.score : "—") + "</strong></div><div>At risk<strong>" + (mazenPm ? mazenPm.atRisk : "—") + "</strong></div><div>90-day coverage<strong>" + (mazenPm ? mazenPm.coverage90 : "—") + "%</strong></div><div>Notes after Mar 2026<strong>" + (mazenPm ? mazenPm.noteCaptureAfterCutoff : "—") + "%</strong></div></div></div></header>" +
      '<nav class="nav"><button data-view="pm"' + (state.view === "pm" ? ' class="on"' : "") + ">PM command</button><button data-view='director'" + (state.view === "director" ? ' class="on"' : "") + ">Director</button><button data-view='model'" + (state.view === "model" ? ' class="on"' : "") + ">How the model scores</button></nav>" +
      (state.view === "pm" ? renderPm(m) : state.view === "director" ? renderDirector(m) : renderModel());

    Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (btn) {
      btn.onclick = function () { state.view = btn.getAttribute("data-view"); render(); };
    });
    var q = document.getElementById("q");
    if (q) q.oninput = function () {
      state.query = q.value;
      var pos = q.selectionStart;
      render();
      var nq = document.getElementById("q");
      if (nq) {
        nq.focus();
        nq.setSelectionRange(pos, pos);
      }
    };
    var health = document.getElementById("health");
    if (health) health.onchange = function () { state.health = health.value; render(); };
    Array.prototype.forEach.call(document.querySelectorAll("[data-store]"), function (btn) {
      btn.onclick = function () { state.selectedKey = btn.getAttribute("data-store"); render(); };
    });
    var sampleBtn = document.getElementById("sampleBtn");
    if (sampleBtn) sampleBtn.onclick = function () {
      state.sample = E.makeSamplePeerBook(state.seed.records);
      render();
    };
    function ask(question) {
      var ctx = { org: m.org, engagements: m.engagements, stores: m.stores, pms: m.pms, teams: m.teams };
      state.answers.push(E.askLocalAssistant(question, ctx));
      render();
      var body = document.getElementById("askBody");
      if (body) body.scrollTop = body.scrollHeight;
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-q]"), function (btn) {
      btn.onclick = function () { ask(btn.getAttribute("data-q")); };
    });
    var form = document.getElementById("askForm");
    if (form) form.onsubmit = function (ev) {
      ev.preventDefault();
      var input = document.getElementById("askQ");
      if (input && input.value.trim()) ask(input.value.trim());
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var raw = JSON.parse(document.getElementById("report-data").textContent);
    raw.assignedPm.teamId = "team-canada-a";
    state.seed = raw;
    render();
  });
})();
