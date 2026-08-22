/* PM Intel local engine — no network, no server. */
(function (root) {
  var NOTES_REQUIRED_FROM = "2026-03-01";
  var DEFAULT_AS_OF = "2026-08-18";
  var NOISE = { ltd: 1, limited: 1, inc: 1, incorporated: 1, llc: 1, the: 1, of: 1, and: 1, auto: 1, group: 1, sales: 1, motors: 1, motor: 1, "o/a": 1, oa: 1 };
  var PREFIXES = [
    /^reminder\s+/i,
    /^gotomeeting invitation\s+-\s+/i,
    /^vauto performance review with\s+/i,
    /^vauto performance review\s+/i,
    /^vauto review\s+/i,
    /^vauto session with\s+/i,
    /^vauto session\s+/i,
    /^vauto call with\s+/i,
    /^vauto call\s+/i,
    /^performance review\s+/i,
    /^call with [^ ]+\s+at\s+/i,
    /^meeting with [^ ]+\s+at\s+/i,
  ];
  var PERSON_MEETING = /^(meeting with|vauto call with|vauto session with|vauto performance review with|performance review)\s+/i;
  var ALIASES = {
    "AJAX NISSAN": "AJAX NISSAN",
    "ACURA PICKERING": "ACURA PICKERING",
    "ARROW MOTORS": "ARROW MOTORS",
    "ATLANTIC MAZDA": "ATLANTIC MAZDA",
    "AUDI HALIFAX": "AUDI HALIFAX",
    "CAMPUS HONDA": "CAMPUS HONDA VICTORIA",
    "CANYON CREEK TOYOTA": "CANYON CREEK TOYOTA",
    "CAPITAL HYUNDAI": "CAPITAL HYUNDAI",
    CARHUB: "YOUR WAY AUTO",
    "COUNTY MAZDA": "COUNTY MAZDA",
    "DISCOVER KIA": "DISCOVER KIA CHARLOTTETOWN",
    "DIXIE FORD": "DIXIE FORD",
    "HUMBER FORD": "HUMBER MOTORS FORD",
    "JAGUAR LAND ROVER MONCTON": "STEELE LAND ROVER JAGUAR MONCTON",
    "JIM PATTISON AUTO GROUP": "THE JIM PATTISON AUTO GROUP HEADQUARTERS",
    "JIM PATTISON HYUNDAI NORTHSHORE": "JIM PATTISON HYUNDAI NORTHSHORE",
    "JIM PATTISON TOYOTA & LEXUS VICTORIA": "JIM PATTISON TOYOTA VICTORIA",
    "LAKE SIDE CHEVROELT": "LAKESIDE CHEVROLET BUICK GMC LTD",
    "LAKESIDE CHEVROLET": "LAKESIDE CHEVROLET BUICK GMC LTD",
    LAKESIDE: "LAKESIDE CHEVROLET BUICK GMC LTD",
    "MIDWAY NISSAN": "MIDWAY NISSAN",
    "MONCTON ACURA": "ACURA OF MONCTON",
    "MORNINGSIDE NISSAN": "MORNINGSIDE NISSAN",
    "PICKERING HONDA": "PICKERING HONDA",
    "PORSCHE OF HALIFAX": "PORSCHE OF HALIFAX",
    "PROVINCIAL CHRYSLER": "PROVINCIAL CHRYSLER DODGE JEEP RAM",
    "STEELE AUTO GROUP": "STEELE AUTO GROUP",
    "STEELE SUBARU": "STEELE SUBARU",
    "STEELE VOLKSWAGEN": "STEELE VOLKSWAGEN",
    "BRIDGEWATER VOLKSWAGEN": "STEELE VOLKSWAGEN",
    "STOCKIE CHRYSLER": "STOCKIE CHRYSLER",
    "TANTRAMAR CHEVROLET": "TANTRAMAR CHEVROLET BUICK GMC (2009) LIMITED",
    "TOYOTA SURREY": "JIM PATTISON TOYOTA - SURREY",
    "UNICAR AUTO GROUP": "UNICAR AUTO GROUP",
    "VOLKSWAGEN SURREY": "JIM PATTISON VOLKSWAGEN SURREY",
    "VOLVO NORTH VANCOUVER": "JIM PATTISON VOLVO CARS NORTH VANCOUVER",
    "YOUR WAY AUTO": "YOUR WAY AUTO",
    "PARK LANE CHEVROLET": "PARK LANE CHEVROLET CADILLAC LTD",
    "JIM PATTISON CHRYSLER": "JIM PATTISON CHRYSLER JEEP DODGE",
    "STEELE BUICK GMC": "STEELE BUICK GMC",
    "FREDERICTON HYUNDAI": "FREDERICTON HYUNDAI",
    "STEELE VALLEY CHEV": "STEELE VALLEY CHEVROLET",
    "STEELE VALLEY CHEVROLET": "STEELE VALLEY CHEVROLET",
    "ST CROIX AUTO": "ST. CROIX AUTO GROUP",
    "STEELE ST JOHNS CHRYSLER DODGE JEEP RAM": "STEELE ST. JOHN'S CHRYSLER DODGE JEEP RAM",
    "CANYON CREEK TOYOTA 2018": "CANYON CREEK TOYOTA (2018)",
  };
  var GROUP_RULES = [
    { test: /\bJIM PATTISON\b/, group: "Jim Pattison Auto Group" },
    { test: /\bSTEELE\b/, group: "Steele Auto Group" },
    { test: /\bCAPITAL\b/, group: "Capital Auto Group" },
    { test: /\bCAMPUS\b/, group: "Campus Auto Group" },
    { test: /\bRECAR\b/, group: "RECAR" },
    { test: /\bDRIVE AUTO GROUP\b|\bACURA EAST\b/, group: "Drive Auto Group" },
    { test: /\bYOUR WAY\b|\bCARHUB\b/, group: "Your Way Auto" },
    { test: /\bWALLACE\b/, group: "Wallace Group" },
    { test: /\bSIMMONS HONDA\b/, group: "Simmons Honda" },
    { test: /\bDIXIE\b/, group: "Dixie" },
    { test: /\bGANDER\b/, group: "Gander" },
    { test: /\bFREDERICTON\b/, group: "Fredericton" },
  ];
  var ACTIVITY_WEIGHT = {
    "Quarterly Business Review": 1,
    "Performance Review": 0.85,
    "Risk and Retention VAE Save": 0.95,
    "Risk & Retention VAE Proactive": 0.9,
    "Onsite Training": 0.8,
    "Follow-Up Visit": 0.7,
    Demo: 0.6,
    General: 0.45,
    Unspecified: 0.35,
  };
  var POSITIVE = ["appreciation", "appreciated", "grateful", "gratitude", "willingness to learn", "willing to learn", "engaged", "engagement", "proactive", "cooperative", "receptive", "positive", "confident", "confidence", "excited", "100%", "thank", "helpful", "committed", "collaboration", "collaborate"];
  var RISK = ["frustration", "frustrated", "frustrating", "concern", "concerned", "dissatisfaction", "dissatisfied", "angry", "upset", "stupid", "glitch", "glitches", "issue", "problem", "delay", "cancelled", "cancellation", "risk", "inactive", "confusion", "confused", "mandated", "technical difficulties"];
  var TOPIC_MAP = {
    Inventory: ["inventory", "stock", "aged", "aging", "units", "days supply", "turn"],
    Pricing: ["pricing", "price", "gross", "discount", "market", "pbs"],
    Appraisals: ["appraisal", "trade", "look-to-book", "look to book", "ltb", "cim"],
    Reconditioning: ["reconditioning", "recon", "repair", "obd2"],
    Training: ["training", "coach", "demo", "onboard", "learn"],
    Photos: ["photo", "vdp", "merchandising", "description"],
    System: ["system", "glitch", "login", "profit time", "v auto", "vauto"],
    Leads: ["lead", "bdc", "appointment", "customer"],
  };
  var STARTERS = [
    "When was the last engagement with Ajax Nissan?",
    "What is the temperature at Steele Subaru?",
    "Which stores are at risk?",
    "Who should I call this week?",
    "How often am I seeing Jim Pattison Toyota Surrey?",
    "How is my PM score calculated?",
    "Compare Team Canada A vs Team Canada B",
  ];

  function slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function cleanLabel(value) {
    return String(value || "").replace(/^\(D\)\s*/i, "").replace(/\s+/g, " ").trim();
  }
  function tokenize(value) {
    return cleanLabel(value).toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, " ").split(/\s+/).filter(function (t) {
      return t && !NOISE[t.toLowerCase()] && t.length > 1;
    });
  }
  function looksLikeStoreName(raw) {
    var t = cleanLabel(raw);
    if (!t) return false;
    if (/vauto|meeting with|gotomeeting|call with|reminder /i.test(t)) return false;
    var letters = t.replace(/[^A-Za-z]/g, "");
    if (!letters) return false;
    return letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7 || t === t.toUpperCase();
  }
  function stripActivityPrefix(raw) {
    var value = cleanLabel(raw);
    var changed = true;
    while (changed) {
      changed = false;
      PREFIXES.forEach(function (re) {
        if (re.test(value)) {
          value = value.replace(re, "").trim();
          changed = true;
        }
      });
    }
    return value;
  }
  function splitMultiStore(raw) {
    var stripped = stripActivityPrefix(raw);
    if (!stripped) return [];
    return stripped.split(/\s*(?:,|&| and )\s*/i).map(function (p) { return p.replace(/\.+$/, "").trim(); }).filter(Boolean);
  }
  function dealerGroupFor(name) {
    var upper = name.toUpperCase();
    for (var i = 0; i < GROUP_RULES.length; i++) if (GROUP_RULES[i].test.test(upper)) return GROUP_RULES[i].group;
    if (/^\(D\)/i.test(name) || / GROUP$/.test(upper)) return cleanLabel(name);
    return null;
  }
  function jaccard(a, b) {
    if (!a.length || !b.length) return 0;
    var set = {};
    var inter = 0;
    a.forEach(function (x) { set[x] = 1; });
    b.forEach(function (x) { if (set[x]) inter += 1; });
    var union = {};
    a.concat(b).forEach(function (x) { union[x] = 1; });
    return inter / Object.keys(union).length;
  }
  function buildCatalog(names) {
    var stores = {};
    names.forEach(function (name) {
      var cleaned = cleanLabel(name);
      if (looksLikeStoreName(cleaned)) stores[cleaned.toUpperCase()] = 1;
    });
    return Object.keys(stores);
  }
  function kindRank(kind) {
    return kind === "store" ? 3 : kind === "group" ? 2 : kind === "relationship" ? 1 : 0;
  }
  function resolveName(raw, catalog) {
    var cleaned = cleanLabel(raw);
    if (!cleaned) return { storeKey: "unmapped", storeName: "Unmapped engagement", dealerGroup: null, kind: "unmapped", match: "unresolved" };
    var isDealerGroupRow = /^\(D\)/i.test(raw) || / GROUP$/.test(cleaned.toUpperCase());
    var stripped = stripActivityPrefix(cleaned);
    if (ALIASES[stripped.toUpperCase()]) {
      var aliased = ALIASES[stripped.toUpperCase()];
      return { storeKey: slugify(aliased), storeName: aliased, dealerGroup: dealerGroupFor(aliased), kind: isDealerGroupRow ? "group" : "store", match: "alias" };
    }
    if (looksLikeStoreName(cleaned)) {
      var exact = cleaned.toUpperCase();
      return { storeKey: slugify(exact), storeName: exact, dealerGroup: dealerGroupFor(exact), kind: isDealerGroupRow ? "group" : "store", match: "exact" };
    }
    if (PERSON_MEETING.test(cleaned) && !/\bat\b/i.test(cleaned) && stripped.split(" ").length <= 3) {
      return { storeKey: slugify("relationship-" + stripped), storeName: cleaned, dealerGroup: null, kind: "relationship", match: "title" };
    }
    var tokens = tokenize(stripped);
    var best = null;
    catalog.forEach(function (name) {
      var score = jaccard(tokens, tokenize(name));
      var contains = name.indexOf(stripped.toUpperCase()) >= 0 || stripped.toUpperCase().indexOf(name) >= 0;
      var blended = score + (contains ? 0.15 : 0);
      if (!best || blended > best.score) best = { name: name, score: blended };
    });
    if (best && best.score >= 0.45) {
      return { storeKey: slugify(best.name), storeName: best.name, dealerGroup: dealerGroupFor(best.name), kind: "store", match: "fuzzy" };
    }
    if (stripped) {
      var fallback = stripped.toUpperCase();
      return { storeKey: slugify(fallback), storeName: fallback, dealerGroup: dealerGroupFor(fallback), kind: "unmapped", match: "unresolved" };
    }
    return { storeKey: slugify(cleaned), storeName: cleaned, dealerGroup: null, kind: "unmapped", match: "unresolved" };
  }
  function attributeEngagement(account, subject, catalog) {
    var raw = cleanLabel(account) || cleanLabel(subject);
    var pieces = splitMultiStore(raw);
    var source = pieces.length > 1 ? pieces : [raw];
    var seen = {};
    var out = [];
    source.forEach(function (piece) {
      var resolved = resolveName(piece, catalog);
      if (seen[resolved.storeKey]) return;
      seen[resolved.storeKey] = 1;
      out.push(resolved);
    });
    if (!out.length) out.push(resolveName(raw, catalog));
    return out;
  }
  function hasCapturedNotes(comments) {
    var text = String(comments || "").trim();
    if (!text) return false;
    if (text.indexOf("No comments captured") === 0) return false;
    if (/no summary found/i.test(text)) return false;
    if (text === "null") return false;
    return true;
  }
  function extractImpression(comments) {
    if (!hasCapturedNotes(comments)) return null;
    var text = comments || "";
    var match = text.match(/\*\*Customer Impression\*\*\s*([\s\S]*?)(?:\*\*|$)/i);
    if (match) return match[1].replace(/^null\s*/i, "").trim() || null;
    return text.replace(/^null\s*/i, "").trim() || null;
  }
  function lexiconHits(text, list) {
    var lower = text.toLowerCase();
    return list.filter(function (word) { return lower.indexOf(word) >= 0; });
  }
  function topicsFrom(text) {
    var lower = text.toLowerCase();
    return Object.keys(TOPIC_MAP).filter(function (topic) {
      return TOPIC_MAP[topic].some(function (word) { return lower.indexOf(word) >= 0; });
    });
  }
  function temperatureLabel(score) {
    if (score >= 80) return "Hot";
    if (score >= 65) return "Warm";
    if (score >= 45) return "Mixed";
    if (score >= 30) return "Cool";
    return "Cold";
  }
  function readTemperature(comments, date, notesRequiredFrom) {
    notesRequiredFrom = notesRequiredFrom || NOTES_REQUIRED_FROM;
    var notesRequired = date >= notesRequiredFrom;
    if (!hasCapturedNotes(comments)) {
      return {
        status: notesRequired ? "missing_notes" : "legacy_unscored",
        score: null,
        label: notesRequired ? "Notes not captured" : "Not captured (legacy)",
        impression: null,
        positiveHits: [],
        riskHits: [],
        topics: [],
        notesRequired: notesRequired,
      };
    }
    var impression = extractImpression(comments);
    var source = impression || comments || "";
    var positiveHits = lexiconHits(source, POSITIVE);
    var riskHits = lexiconHits(source, RISK);
    var mixedCue = /mix of|however|but also|despite/i.test(source);
    var score = 58 + positiveHits.length * 6 - riskHits.length * 8;
    if (mixedCue) score -= 6;
    if (/100%/.test(source)) score += 8;
    if (/\bstupid\b/i.test(source)) score -= 12;
    score = Math.max(5, Math.min(97, Math.round(score)));
    return {
      status: "scored",
      score: score,
      label: temperatureLabel(score),
      impression: impression,
      positiveHits: positiveHits,
      riskHits: riskHits,
      topics: topicsFrom(source),
      notesRequired: notesRequired,
    };
  }
  function activityWeight(type) { return ACTIVITY_WEIGHT[type] != null ? ACTIVITY_WEIGHT[type] : 0.4; }
  function daysBetween(from, to) {
    return Math.round((Date.parse(to + "T00:00:00") - Date.parse(from + "T00:00:00")) / 86400000);
  }
  function healthLabel(score) {
    if (score >= 75) return "Healthy";
    if (score >= 55) return "Watch";
    return "At Risk";
  }
  function recencyPoints(days) {
    if (days == null) return 0;
    if (days <= 14) return 30;
    if (days <= 30) return 26;
    if (days <= 45) return 20;
    if (days <= 60) return 14;
    if (days <= 90) return 8;
    if (days <= 120) return 4;
    return 2;
  }
  function cadencePoints(last90, last180) {
    return { points: Math.round(18 * Math.min(1, last90 / 3) + 12 * Math.min(1, last180 / 6)), expected90: 3 };
  }
  function mixPoints(engagements) {
    var types = {};
    var weighted = 0;
    engagements.forEach(function (row) {
      types[row.activityType] = (types[row.activityType] || 0) + 1;
      weighted += activityWeight(row.activityType);
    });
    var quality = engagements.length ? weighted / engagements.length : 0;
    return { points: Math.round(quality * 25), weightedQuality: Math.round(quality * 100), types: types };
  }
  function nextActionFor(store) {
    if (!store.lastEngagement.date) return "No completed activity in this book — schedule an introduction.";
    var days = store.lastEngagement.daysSince != null ? store.lastEngagement.daysSince : 999;
    if (store.label === "At Risk" || days > 60) return "Book a Performance Review this week. Cadence has slipped.";
    if (store.temperature.status === "scored" && (store.temperature.label === "Cool" || store.temperature.label === "Cold")) return "Temperature is cool — follow up on the last concern before the next QBR.";
    if (store.temperature.status === "missing_notes") return "Last visit has no notes. Capture Customer Impression on the next call so temperature can be scored.";
    if (days > 30) return "Schedule the monthly touch. Last visit is over 30 days ago.";
    if (store.counts.last90 < 3) return "Add one more structured review this quarter to keep cadence healthy.";
    return "Keep the monthly cadence. Account is in good shape.";
  }
  function normalizeRecaps(files) {
    var catalog = buildCatalog(files.reduce(function (acc, file) {
      return acc.concat(file.records.map(function (row) { return row.account || row.subject; }));
    }, []));
    var out = [];
    files.forEach(function (file, fileIndex) {
      file.records.forEach(function (row, index) {
        var attributions = attributeEngagement(row.account, row.subject, catalog);
        var primary = attributions.slice().sort(function (a, b) { return kindRank(b.kind) - kindRank(a.kind); })[0];
        out.push(Object.assign({}, row, {
          id: file.assignedPm.id + "-" + fileIndex + "-" + index,
          pmId: row.assignedPmId || file.assignedPm.id,
          pmName: row.assignedPmName || file.assignedPm.name,
          hasNotes: hasCapturedNotes(row.comments),
          temperature: readTemperature(row.comments, row.date, file.notesRequiredFrom || NOTES_REQUIRED_FROM),
          attributions: attributions,
          primary: primary,
        }));
      });
    });
    return out;
  }
  function scoreStore(storeKey, engagements, asOf) {
    asOf = asOf || DEFAULT_AS_OF;
    var sorted = engagements.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var latest = sorted[0];
    var daysSince = latest ? daysBetween(latest.date, asOf) : null;
    var last90 = sorted.filter(function (row) { return daysBetween(row.date, asOf) <= 90; }).length;
    var last180 = sorted.filter(function (row) { return daysBetween(row.date, asOf) <= 180; }).length;
    var last30 = sorted.filter(function (row) { return daysBetween(row.date, asOf) <= 30; }).length;
    var scoredTemps = sorted.filter(function (row) { return row.temperature.status === "scored" && row.temperature.score != null; });
    var mix = mixPoints(sorted);
    var cadence = cadencePoints(last90, last180);
    var recency = recencyPoints(daysSince);
    var tempAverage = scoredTemps.length ? Math.round(scoredTemps.reduce(function (sum, row) { return sum + row.temperature.score; }, 0) / scoredTemps.length) : null;
    var tempPoints = null;
    var applied = false;
    var reason = "No Customer Impression notes — temperature excluded from the score (not treated as a bad engagement).";
    if (tempAverage != null) {
      tempPoints = Math.round((tempAverage / 100) * 15);
      applied = true;
      reason = "Temperature uses " + scoredTemps.length + " scored note(s). Missing historical notes are ignored.";
    }
    var earned = recency + cadence.points + mix.points + (applied ? tempPoints || 0 : 0);
    var max = 30 + 30 + 25 + (applied ? 15 : 0);
    var score = Math.max(0, Math.min(100, Math.round((earned / Math.max(max, 1)) * 100)));
    var afterCutoff = sorted.filter(function (row) { return row.temperature.notesRequired; }).length;
    var withNotesAfterCutoff = sorted.filter(function (row) { return row.temperature.notesRequired && row.hasNotes; }).length;
    var latestTemp = scoredTemps[0] && scoredTemps[0].temperature;
    var store = {
      storeKey: storeKey,
      storeName: (latest && latest.primary.storeName) || storeKey,
      dealerGroup: (latest && latest.primary.dealerGroup) || null,
      kind: (latest && latest.primary.kind) || "store",
      pmId: (latest && latest.pmId) || "",
      pmName: (latest && latest.pmName) || "",
      score: score,
      label: healthLabel(score),
      temperature: {
        average: tempAverage,
        label: (latestTemp && latestTemp.label) || (sorted[0] && sorted[0].temperature.label) || "No notes",
        status: (latestTemp && latestTemp.status) || (sorted[0] && sorted[0].temperature.status) || "empty",
        readings: scoredTemps.length,
      },
      lastEngagement: {
        date: (latest && latest.date) || null,
        daysSince: daysSince,
        type: (latest && latest.activityType) || null,
        subject: (latest && latest.subject) || null,
        createdBy: (latest && latest.createdBy) || null,
      },
      counts: {
        total: sorted.length,
        last30: last30,
        last90: last90,
        last180: last180,
        withNotes: sorted.filter(function (row) { return row.hasNotes; }).length,
        withNotesAfterCutoff: withNotesAfterCutoff,
        afterCutoff: afterCutoff,
      },
      breakdown: {
        recency: { points: recency, max: 30, daysSince: daysSince, lastDate: (latest && latest.date) || null },
        cadence: { points: cadence.points, max: 30, last90: last90, last180: last180, expected90: cadence.expected90 },
        mix: { points: mix.points, max: 25, weightedQuality: mix.weightedQuality, types: mix.types },
        temperature: { points: tempPoints, max: 15, applied: applied, average: tempAverage, readings: scoredTemps.length, reason: reason },
      },
      nextAction: "",
      engagements: sorted,
    };
    store.nextAction = nextActionFor(store);
    return store;
  }
  function scoreBook(engagements, asOf) {
    asOf = asOf || DEFAULT_AS_OF;
    var buckets = {};
    engagements.forEach(function (row) {
      row.attributions.forEach(function (attr) {
        if (attr.kind !== "store" && attr.kind !== "group") return;
        var key = row.pmId + "::" + attr.storeKey;
        var clone = Object.assign({}, row, { primary: attr });
        buckets[key] = buckets[key] || [];
        buckets[key].push(clone);
      });
    });
    return Object.keys(buckets).map(function (key) {
      return scoreStore(buckets[key][0].primary.storeKey, buckets[key], asOf);
    }).sort(function (a, b) {
      return a.score - b.score || (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0);
    });
  }
  function scorePm(stores, org) {
    if (!stores.length) return null;
    var pmId = stores[0].pmId;
    var pm = org.pms.filter(function (item) { return item.id === pmId; })[0];
    var team = org.teams.filter(function (item) { return item.id === ((pm && pm.teamId) || ""); })[0];
    var scores = stores.map(function (store) { return store.score; }).sort(function (a, b) { return a - b; });
    var avg = Math.round(scores.reduce(function (sum, n) { return sum + n; }, 0) / scores.length);
    var coverage30 = stores.filter(function (store) { return (store.lastEngagement.daysSince != null ? store.lastEngagement.daysSince : 999) <= 30; }).length / stores.length;
    var coverage90 = stores.filter(function (store) { return (store.lastEngagement.daysSince != null ? store.lastEngagement.daysSince : 999) <= 90; }).length / stores.length;
    var after = stores.reduce(function (sum, store) { return sum + store.counts.afterCutoff; }, 0);
    var notes = stores.reduce(function (sum, store) { return sum + store.counts.withNotesAfterCutoff; }, 0);
    var mixQuality = stores.reduce(function (sum, store) { return sum + store.breakdown.mix.weightedQuality; }, 0) / Math.max(stores.length, 1);
    var lastActivity = stores.map(function (store) { return store.lastEngagement.date; }).filter(Boolean).sort().slice(-1)[0] || null;
    var score = Math.round(avg * 0.45 + coverage90 * 100 * 0.25 + coverage30 * 100 * 0.15 + mixQuality * 0.15);
    return {
      pmId: pmId,
      pmName: stores[0].pmName,
      teamId: (team && team.id) || "unassigned",
      teamName: (team && team.name) || "Unassigned",
      storeCount: stores.length,
      avgStoreScore: avg,
      medianStoreScore: scores[Math.floor(scores.length / 2)],
      atRisk: stores.filter(function (store) { return store.label === "At Risk"; }).length,
      watch: stores.filter(function (store) { return store.label === "Watch"; }).length,
      healthy: stores.filter(function (store) { return store.label === "Healthy"; }).length,
      coverage30: Math.round(coverage30 * 100),
      coverage90: Math.round(coverage90 * 100),
      noteCaptureAfterCutoff: after ? Math.round((notes / after) * 100) : 0,
      mixQuality: Math.round(mixQuality),
      lastActivity: lastActivity,
      score: Math.max(0, Math.min(100, score)),
      label: healthLabel(score),
    };
  }
  function scoreTeams(pms, org) {
    return org.teams.map(function (team) {
      var members = pms.filter(function (pm) { return pm.teamId === team.id; });
      var director = org.directors.filter(function (item) { return item.id === team.directorId; })[0];
      var avgPmScore = members.length ? Math.round(members.reduce(function (sum, pm) { return sum + pm.score; }, 0) / members.length) : 0;
      return {
        teamId: team.id,
        teamName: team.name,
        directorId: team.directorId,
        directorName: (director && director.name) || "Director",
        pms: members,
        storeCount: members.reduce(function (sum, pm) { return sum + pm.storeCount; }, 0),
        avgPmScore: avgPmScore,
        avgStoreScore: members.length ? Math.round(members.reduce(function (sum, pm) { return sum + pm.avgStoreScore; }, 0) / members.length) : 0,
        atRisk: members.reduce(function (sum, pm) { return sum + pm.atRisk; }, 0),
        coverage90: members.length ? Math.round(members.reduce(function (sum, pm) { return sum + pm.coverage90; }, 0) / members.length) : 0,
        score: avgPmScore,
        label: healthLabel(avgPmScore),
      };
    });
  }
  function seedOrgFromFiles(files) {
    return {
      company: "vAuto / Cox Automotive — Performance",
      directors: [{ id: "dir-canada", name: "Canada Performance Director" }],
      teams: [
        { id: "team-canada-a", name: "Team Canada A", directorId: "dir-canada" },
        { id: "team-canada-b", name: "Team Canada B", directorId: "dir-canada" },
      ],
      pms: files.map(function (file, index) {
        return {
          id: file.assignedPm.id,
          name: file.assignedPm.name,
          teamId: file.assignedPm.teamId || (index === 0 ? "team-canada-a" : "team-" + file.assignedPm.id),
          region: file.assignedPm.region,
        };
      }),
    };
  }
  function makeSamplePeerBook(source, asOf) {
    asOf = asOf || DEFAULT_AS_OF;
    var records = source.slice(0, 180).map(function (row, index) {
      var shift = index % 3 === 0 ? 12 : index % 3 === 1 ? -8 : 4;
      var next = new Date(Date.parse(row.date + "T00:00:00") + shift * 86400000);
      var iso = next.toISOString().slice(0, 10);
      return Object.assign({}, row, {
        date: iso > asOf ? row.date : iso,
        account: row.account.replace(/JIM PATTISON/g, "SAMPLE WEST").replace(/STEELE/g, "SAMPLE EAST"),
        subject: "[SAMPLE] " + row.subject,
        comments: index % 4 === 0 ? row.comments : "No comments captured in the exported report.",
        createdBy: index % 5 === 0 ? "Automated Process" : "Sample PM — West",
        assignedPmId: "pm-sample-west",
        assignedPmName: "Sample PM — West",
      });
    });
    return {
      sourceFile: "Illustration peer recap (not live Salesforce)",
      assignedPm: { id: "pm-sample-west", name: "Sample PM — West", role: "Performance Manager", region: "West", teamId: "team-canada-b" },
      records: records,
    };
  }
  function uniqueStores(stores) {
    var seen = {};
    return stores.filter(function (store) {
      var key = store.pmId + ":" + store.storeKey;
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });
  }
  function resolveStores(question, stores) {
    var q = question.toLowerCase();
    return uniqueStores(stores.map(function (store) {
      var score = 0;
      if (q.indexOf(store.storeName.toLowerCase()) >= 0) score += 10;
      tokenize(store.storeName).forEach(function (token) {
        if (token.length > 3 && q.indexOf(token.toLowerCase()) >= 0) score += 2;
      });
      return { store: store, score: score };
    }).filter(function (row) { return row.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 6).map(function (row) { return row.store; }));
  }
  function searchEngagements(question, engagements, limit) {
    var terms = tokenize(question).map(function (t) { return t.toLowerCase(); });
    if (!terms.length) return [];
    return engagements.map(function (row) {
      var blob = (row.primary.storeName + " " + row.subject + " " + (row.comments || "")).toLowerCase();
      return { row: row, hits: terms.filter(function (term) { return blob.indexOf(term) >= 0; }).length };
    }).filter(function (row) { return row.hits > 0; }).sort(function (a, b) { return b.hits - a.hits || b.row.date.localeCompare(a.row.date); }).slice(0, limit || 8).map(function (row) { return row.row; });
  }
  function citeStore(store) {
    return { storeKey: store.storeKey, storeName: store.storeName, date: store.lastEngagement.date || undefined, subject: store.lastEngagement.subject || undefined, activityType: store.lastEngagement.type || undefined };
  }
  function citeEngagement(row) {
    return { storeKey: row.primary.storeKey, storeName: row.primary.storeName, date: row.date, subject: row.subject, activityType: row.activityType, excerpt: row.temperature.impression || (row.hasNotes ? String(row.comments || "").slice(0, 180) : undefined) };
  }
  function followups(intent, stores) {
    var name = stores[0] && stores[0].storeName;
    if (intent === "briefing") return ["Which stores are at risk?", "What is my note capture rate after March 2026?"];
    return [
      name ? "When was the last engagement with " + name + "?" : "Which stores are at risk?",
      name ? "What is the temperature at " + name + "?" : "Who should I call this week?",
      "How is my PM score calculated?",
    ];
  }
  function empty(intent, headline, answer, follow) {
    return { question: "", intent: intent, headline: headline, answer: answer, bullets: [], citations: [], suggestedFollowups: follow || [] };
  }
  function detectIntent(question) {
    var q = question.toLowerCase();
    if (/last (engagement|visit|call|touch|seen|review)|when did|when was/.test(q)) return "last_engagement";
    if (/temperature|sentiment|impression|feel|hot|cold|warm/.test(q)) return "temperature";
    if (/at risk|overdue|stale|haven'?t seen|neglected|who needs/.test(q)) return "at_risk";
    if (/how often|cadence|frequency|how many times/.test(q)) return "cadence";
    if (/this week|briefing|who should i (call|see|visit)|priorit/.test(q)) return "briefing";
    if (/team|director|vs the other|compared to team/.test(q)) return "team_compare";
    if (/compare|versus| vs /.test(q)) return "compare";
    if (/notes|discuss|talked about|topics/.test(q)) return "notes";
    if (/pm score|my score|performance manager score|how am i doing/.test(q)) return "pm_score";
    if (/score|health|rating/.test(q)) return "score";
    return "search";
  }
  function lastEngagementAnswer(stores) {
    if (!stores.length) return empty("last_engagement", "I need a store name", "Ask with a dealer name, for example: “When was the last engagement with Ajax Nissan?”", ["Which stores are at risk?", "Who should I call this week?"]);
    var store = stores[0];
    var last = store.lastEngagement;
    return {
      question: "",
      intent: "last_engagement",
      headline: last.date ? store.storeName + " — " + last.date : store.storeName + " has no dated activity",
      answer: last.date
        ? "Last completed engagement with " + store.storeName + " was " + last.date + " (" + last.daysSince + " days before the recap date) — " + last.type + ". " + (last.createdBy === "Automated Process" ? "Logged by the automated recap process." : "Logged by " + last.createdBy + ".") + " Missing comments on older visits are not treated as a poor visit."
        : "No completed activity is attached to " + store.storeName + " in this recap.",
      bullets: ["Health " + store.score + " (" + store.label + ")", "Temperature: " + store.temperature.label, store.nextAction],
      citations: [citeStore(store)],
      suggestedFollowups: followups("last_engagement", stores),
    };
  }
  function temperatureAnswer(stores) {
    var store = stores[0];
    if (!store) return empty("temperature", "Temperature needs a store", "Temperature is only scored when a Customer Impression exists. Before March 2026, notes were not required, so blank comments do not mean a cold account.", ["Which stores have cold temperature?"]);
    var latestScored = store.engagements.filter(function (row) { return row.temperature.status === "scored"; })[0];
    var answer;
    if (store.temperature.status === "scored") answer = store.storeName + " temperature is " + store.temperature.label + (store.temperature.average != null ? " (" + store.temperature.average + "/100)" : "") + " from " + store.temperature.readings + " scored impression(s).";
    else if (store.temperature.status === "legacy_unscored") answer = store.storeName + " has no Customer Impression notes. Those visits predate the notes requirement (March 2026), so temperature is unknown — not cold.";
    else answer = store.storeName + " has recent activity without captured notes, so temperature is unknown. Capture impression on the next call.";
    return {
      question: "",
      intent: "temperature",
      headline: store.storeName + " — " + store.temperature.label,
      answer: answer,
      bullets: [latestScored && latestScored.temperature.impression ? latestScored.temperature.impression : "No impression paragraph on file.", latestScored ? "Topics: " + (latestScored.temperature.topics.join(", ") || "none tagged") : "No scored notes yet.", store.nextAction],
      citations: [latestScored ? citeEngagement(latestScored) : citeStore(store)],
      suggestedFollowups: followups("temperature", stores),
    };
  }
  function scoreAnswer(stores) {
    var store = stores[0];
    if (!store) return empty("score", "Score a store or ask for at-risk", "Store health is recency + cadence + engagement type. Temperature is added only when notes exist.", ["Which stores are at risk?"]);
    var b = store.breakdown;
    return {
      question: "",
      intent: "score",
      headline: store.storeName + " is " + store.label + " (" + store.score + ")",
      answer: store.storeName + " scores " + store.score + "/100. Recency " + b.recency.points + "/" + b.recency.max + ", cadence " + b.cadence.points + "/" + b.cadence.max + ", type mix " + b.mix.points + "/" + b.mix.max + ". " + b.temperature.reason,
      bullets: ["Last visit: " + (store.lastEngagement.date || "n/a") + " (" + (store.lastEngagement.daysSince != null ? store.lastEngagement.daysSince : "—") + " days)", "Last 90 days: " + store.counts.last90 + " engagements (target 3)", store.nextAction],
      citations: [citeStore(store)],
      suggestedFollowups: followups("score", stores),
    };
  }
  function atRiskAnswer(stores) {
    var risk = stores.filter(function (s) { return s.label === "At Risk"; }).sort(function (a, b) { return a.score - b.score; });
    var stale = stores.slice().sort(function (a, b) { return (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0); });
    var focus = (risk.length ? risk : stale).slice(0, 8);
    return {
      question: "",
      intent: "at_risk",
      headline: risk.length ? risk.length + " stores at risk" : "No stores below the At Risk line",
      answer: risk.length ? "These stores have weak recency or cadence. Blank historical notes did not put them here by themselves." : "No store is below 55. The longest-gap accounts are still worth a look this week.",
      bullets: focus.map(function (store) { return store.storeName + ": " + store.score + " " + store.label + ", last " + (store.lastEngagement.date || "n/a") + " (" + (store.lastEngagement.daysSince != null ? store.lastEngagement.daysSince : "—") + "d)"; }),
      citations: focus.slice(0, 5).map(citeStore),
      suggestedFollowups: ["Who should I call this week?", "How is cadence scored?"],
    };
  }
  function cadenceAnswer(stores) {
    var store = stores[0];
    if (!store) return atRiskAnswer(stores);
    return {
      question: "",
      intent: "cadence",
      headline: store.storeName + " cadence",
      answer: store.storeName + " has " + store.counts.last90 + " engagements in the last 90 days (target 3) and " + store.counts.total + " in the loaded recap. Type quality is " + store.breakdown.mix.weightedQuality + "/100, so QBRs and Performance Reviews count more than unspecified or general tasks.",
      bullets: Object.keys(store.breakdown.mix.types).map(function (type) { return { type: type, n: store.breakdown.mix.types[type] }; }).sort(function (a, b) { return b.n - a.n; }).map(function (row) { return row.type + ": " + row.n; }),
      citations: [citeStore(store)],
      suggestedFollowups: followups("cadence", stores),
    };
  }
  function briefingAnswer(stores, pms) {
    var pm = pms[0];
    var call = stores.filter(function (s) { return s.kind === "store"; }).sort(function (a, b) {
      var risk = Number(a.label === "At Risk") - Number(b.label === "At Risk");
      if (risk) return risk > 0 ? -1 : 1;
      return (b.lastEngagement.daysSince || 0) - (a.lastEngagement.daysSince || 0);
    }).slice(0, 8);
    return {
      question: "",
      intent: "briefing",
      headline: pm ? pm.pmName + " weekly focus" : "Weekly focus",
      answer: pm ? pm.pmName + " book: " + pm.storeCount + " stores, PM score " + pm.score + ", " + pm.coverage90 + "% touched in 90 days, " + pm.atRisk + " at risk. Note capture after March 2026 is " + pm.noteCaptureAfterCutoff + "% — that metric ignores the legacy blank-comment period." : "Load a recap to build the weekly briefing.",
      bullets: call.map(function (store) { return store.storeName + ": " + store.nextAction; }),
      citations: call.slice(0, 5).map(citeStore),
      suggestedFollowups: ["Which stores are at risk?", "What is the temperature on the first one?"],
    };
  }
  function compareAnswer(stores) {
    if (stores.length < 2) return empty("compare", "Name two stores to compare", "Try: “Compare Ajax Nissan vs Pickering Honda”.", ["Which stores are at risk?"]);
    var a = stores[0];
    var b = stores[1];
    return {
      question: "",
      intent: "compare",
      headline: a.storeName + " vs " + b.storeName,
      answer: a.storeName + " is " + a.score + " " + a.label + " (last " + a.lastEngagement.date + ", temp " + a.temperature.label + "). " + b.storeName + " is " + b.score + " " + b.label + " (last " + b.lastEngagement.date + ", temp " + b.temperature.label + ").",
      bullets: [a.storeName + " last 90 days: " + a.counts.last90, b.storeName + " last 90 days: " + b.counts.last90],
      citations: [citeStore(a), citeStore(b)],
      suggestedFollowups: followups("compare", stores),
    };
  }
  function notesAnswer(stores, engagements, question) {
    var pool = stores.length ? stores[0].engagements.filter(function (row) { return row.hasNotes; }) : searchEngagements(question, engagements).filter(function (row) { return row.hasNotes; });
    var rows = pool.slice(0, 5);
    if (!rows.length) return empty("notes", "No captured notes for that ask", "Most 2025–Feb 2026 recap lines have no comments because notes were not required. That is not a negative engagement.", ["Which stores have scored temperature?"]);
    return {
      question: "",
      intent: "notes",
      headline: "Notes (" + rows.length + ")",
      answer: "Grounded in Customer Impression / comments from the Salesforce recap. Legacy blank rows are skipped.",
      bullets: rows.map(function (row) { return row.date + " " + row.primary.storeName + ": " + String(row.temperature.impression || row.comments || "").slice(0, 160); }),
      citations: rows.map(citeEngagement),
      suggestedFollowups: followups("notes", stores),
    };
  }
  function pmAnswer(pms) {
    var pm = pms[0];
    if (!pm) return empty("pm_score", "No PM scored yet", "Import a recap to score a performance manager.", []);
    return {
      question: "",
      intent: "pm_score",
      headline: pm.pmName + " scores " + pm.score + " (" + pm.label + ")",
      answer: "PM score blends portfolio store health (" + pm.avgStoreScore + "), 90-day coverage (" + pm.coverage90 + "%), 30-day coverage (" + pm.coverage30 + "%), and engagement-type quality (" + pm.mixQuality + "). Note capture after the March 2026 requirement is " + pm.noteCaptureAfterCutoff + "% and is reported separately so pre-requirement blanks cannot drag the PM down.",
      bullets: [pm.storeCount + " stores · " + pm.healthy + " healthy · " + pm.watch + " watch · " + pm.atRisk + " at risk", "Last activity in book: " + (pm.lastActivity || "n/a")],
      citations: [],
      suggestedFollowups: ["Which stores are at risk?", "Compare Team Canada A vs Team Canada B"],
    };
  }
  function teamAnswer(teams) {
    var live = teams.filter(function (team) { return team.pms.length; });
    if (!live.length) return empty("team_compare", "Director view needs PM recaps", "Mazen’s book is Team Canada A. Load the illustration peer or another recap onto Team Canada B to compare teams.", ["Who should I call this week?"]);
    return {
      question: "",
      intent: "team_compare",
      headline: live.map(function (t) { return t.teamName + " " + t.score; }).join(" vs "),
      answer: "Director score is the average of PM scores on that team. Store health still excludes legacy missing notes.",
      bullets: live.map(function (team) { return team.teamName + ": " + team.pms.length + " PM(s), " + team.storeCount + " stores, " + team.coverage90 + "% 90-day coverage, " + team.atRisk + " at risk"; }),
      citations: [],
      suggestedFollowups: ["Which stores are at risk?", "How is my PM score calculated?"],
    };
  }
  function askLocalAssistant(question, ctx) {
    var intent = detectIntent(question);
    var stores = resolveStores(question, ctx.stores);
    var result;
    if (intent === "last_engagement") result = lastEngagementAnswer(stores);
    else if (intent === "temperature") result = temperatureAnswer(stores.length ? stores : ctx.stores.filter(function (s) { return s.temperature.status === "scored"; }).slice(0, 1));
    else if (intent === "score") result = scoreAnswer(stores);
    else if (intent === "at_risk") result = atRiskAnswer(ctx.stores);
    else if (intent === "cadence") result = cadenceAnswer(stores);
    else if (intent === "briefing") result = briefingAnswer(ctx.stores, ctx.pms);
    else if (intent === "compare") result = compareAnswer(stores);
    else if (intent === "notes") result = notesAnswer(stores, ctx.engagements, question);
    else if (intent === "pm_score") result = pmAnswer(ctx.pms);
    else if (intent === "team_compare") result = teamAnswer(ctx.teams);
    else {
      var searchHits = searchEngagements(question, ctx.engagements);
      if (stores.length === 1 && /last|when|temp|score/.test(question.toLowerCase())) result = lastEngagementAnswer(stores);
      else if (searchHits.length) {
        result = {
          question: question,
          intent: "search",
          headline: "From the recap",
          answer: "I matched " + searchHits.length + " engagement(s) in the local book. Nothing left this machine.",
          bullets: searchHits.map(function (row) { return row.date + " " + row.primary.storeName + ": " + row.activityType + " — " + row.subject; }),
          citations: searchHits.map(citeEngagement),
          suggestedFollowups: followups("search", stores),
        };
      } else result = briefingAnswer(ctx.stores, ctx.pms);
    }
    result.question = question;
    if (!result.suggestedFollowups.length) result.suggestedFollowups = followups(intent, stores);
    return result;
  }

  var api = {
    NOTES_REQUIRED_FROM: NOTES_REQUIRED_FROM,
    DEFAULT_AS_OF: DEFAULT_AS_OF,
    STARTERS: STARTERS,
    normalizeRecaps: normalizeRecaps,
    scoreBook: scoreBook,
    scorePm: scorePm,
    scoreTeams: scoreTeams,
    seedOrgFromFiles: seedOrgFromFiles,
    makeSamplePeerBook: makeSamplePeerBook,
    askLocalAssistant: askLocalAssistant,
    resolveName: resolveName,
    readTemperature: readTemperature,
    buildCatalog: buildCatalog,
  };
  root.PMIntel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
