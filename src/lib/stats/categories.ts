/**
 * Transaction category classification rules.
 *
 * Maps keywords found in transaction descriptions/counterparties
 * to spending categories. German keywords included for DKB transactions.
 */

import { UnifiedTransaction } from "@/lib/banking/types";

export const CATEGORIES = [
  "Groceries",
  "Bills",
  "Rent",
  "Transport",
  "Travel",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Dining",
  "Subscriptions",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

interface CategoryRule {
  category: Category;
  /** Substrings matched anywhere in the lowercased search text. */
  keywords: string[];
  /**
   * Keywords that must appear as a standalone word (word-boundary on both
   * sides) rather than as a bare substring embedded in a longer word.
   *
   * Use this for short/generic tokens whose *embedded* occurrence inside
   * another word is a false positive, but whose *standalone* occurrence
   * is a genuine match — e.g. German "wohnung" ("flat"/"apartment")
   * should match a genuine standalone "Wohnung" but must not match the
   * fused compound "Ferienwohnung" (holiday flat), where it's shadowing a
   * more specific Travel keyword.
   *
   * This does NOT help when the ambiguous word is itself used standalone
   * with a different meaning — e.g. English "rent" is a real standalone
   * word in both "monthly rent" (housing) and "Sixt Rent a Car" (car
   * hire); word-boundary matching can't distinguish those, so that case
   * is instead resolved by matching specific multi-word phrases (see the
   * Rent rule below) rather than the bare word.
   *
   * Trade-off: this also stops "wohnung" from matching inside other
   * compounds such as "Eigentumswohnung" (owner-occupied flat). No such
   * transaction exists in this codebase's fixtures/seed data today, so
   * this is a deliberate, low-risk trade-off rather than a proven
   * regression — flagged for product follow-up if it turns out to matter.
   */
  wholeWordKeywords?: string[];
}

/** Escapes RegExp special characters so a keyword can be safely embedded in a pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `word` appears in `text` as a standalone word, not embedded in a longer word. */
function matchesWholeWord(text: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text);
}

/**
 * Additional substring collisions reviewed (per product request) alongside
 * the confirmed fixes above, but deliberately left unchanged:
 *
 * - "pension" (Travel, guesthouse) also matches genuine standalone German
 *   retirement-pension income (e.g. a private/company "Pension" payout),
 *   which would sort before the Income rule since Travel is checked first.
 *   This is the same shape as "rent"/"swiss" — a genuine standalone word
 *   with two unrelated meanings — but unlike "swiss air"/"swiss.com" there
 *   is no fixed, enumerable phrase for the guesthouse side: real "Pension"
 *   businesses have arbitrary names ("Pension Sonnenschein", "Pension am
 *   See", ...), so narrowing to specific phrases isn't viable, and no
 *   pension-income transaction exists in this app's fixtures/seed data to
 *   confirm the collision is live. Flagged for product follow-up rather
 *   than fixed.
 * - "total" (Transport, TotalEnergies fuel brand): theoretically a generic
 *   English word ("Subtotal", "Total Due"), but those are receipt line-item
 *   phrases, not the kind of counterparty/reference strings that appear in
 *   bank transaction descriptions used by this app. No live collision found
 *   in seed/fixture data — left unchanged.
 * - "db " (Transport, Deutsche Bahn) and "avis" (Travel, car rental): no
 *   plausible German-banking-text collision identified — left unchanged.
 * - "miete" (Rent): genuinely fragile in the same way as bare "rent" — it
 *   only fails to match "Mietwagen" by the accident that "Miet" + "wagen"
 *   never spells "miete" (the compound has no trailing "e" before "wagen").
 *   A description that separates the words ("Miete Wagen") or uses "Miete"
 *   in its generic sense of "rental fee" (not housing) would still match.
 *   Not hardened here: "Miete" is also the ordinary, extremely common way
 *   genuine German housing-rent transactions are written completely bare
 *   ("Miete Oktober", "Miete Mustermann"), so narrowing to specific phrases
 *   (as done for "rent"/"ticket"/"swiss") would sacrifice most real
 *   recall for a collision not observed in this app's data. Flagged as a
 *   known, accepted, pre-existing fragility rather than newly introduced.
 */
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Groceries",
    keywords: [
      "rewe",
      "edeka",
      "aldi",
      "lidl",
      "netto",
      "penny",
      "kaufland",
      "real",
      "dm-drogerie",
      "rossmann",
      "müller",
      "bio company",
      "denns",
      "tegut",
      "globus",
      "marktkauf",
      "famila",
      "nahkauf",
      "supermarkt",
      "lebensmittel",
    ],
  },
  {
    category: "Rent",
    // NOTE on the bare English keyword "rent" (removed, not narrowed):
    // word-boundary matching alone does NOT fix this collision. Car-rental
    // marketing copy like "Sixt Rent a Car" / "Avis Rent a Car" /
    // "Enterprise Rent-A-Car" genuinely uses "rent" as its own standalone
    // word (bounded by spaces/hyphens on both sides) — so `\brent\b` would
    // still match it. The only correct fix is to stop matching bare "rent"
    // altogether and instead match the more specific phrases a genuine
    // housing-rent transaction actually uses ("rent payment", "monthly
    // rent", "rent due", "landlord", "property management") — none of
    // which appear in car-rental copy. This trades away matching a
    // transaction whose *entire* description is just the single word
    // "Rent" with no other context (unseen in this app's fixtures/seed
    // data, and indistinguishable from car-rental "rent" without more
    // context anyway); genuine German rent is unaffected, still caught by
    // "miete"/"mietzahlung"/"hausverwaltung"/"vonovia"/etc.
    keywords: [
      "miete",
      // "mietzahlung" ("rent payment") is a compound word that does NOT
      // contain "miete" as a substring (it's "miet" + "zahlung", missing
      // the trailing "e"), so it needs its own explicit entry. Safe to
      // add as a bare substring: unambiguous, no known collisions.
      "mietzahlung",
      "vonovia",
      "deutsche wohnen",
      "hausverwaltung",
      "nebenkosten",
      "wohnungsgenossenschaft",
      "hausgeld",
      "immobilien",
      "rent payment",
      "monthly rent",
      "rent due",
      "landlord",
      "property management",
    ],
    // See `wholeWordKeywords` doc above: bare "wohnung" is too generic to
    // safely substring-match (it shadows "Ferienwohnung"). Unlike "rent",
    // "wohnung" has no verb-like alternate meaning that produces a
    // same-shaped collision, so word-boundary matching alone fully
    // resolves it: genuine standalone "Wohnung" still matches as a whole
    // word, while it no longer matches fused inside "Ferienwohnung".
    wholeWordKeywords: ["wohnung"],
  },
  {
    // Two bare-substring collisions fixed here via `wholeWordKeywords`
    // (see the mechanism doc on `CategoryRule` above):
    //   - "rwe" (the energy company) is a substring of the ASCII
    //     transliteration of "Überweisung" ("ueberweisung" -> "...be-RWE-
    //     isung"), so a bare-transfer transaction with no more specific
    //     keyword was classifying as Bills. Unlike "rent"/"pension", "rwe"
    //     has no standalone alternate meaning: it never appears as its own
    //     word inside "Überweisung" (no boundary on either side of the
    //     embedded "rwe"), so `\brwe\b` fully resolves the collision while
    //     still matching genuine standalone "RWE Vertrieb AG" etc.
    //   - "gas" (utility) is a substring of "Gaststätte" (restaurant),
    //     shadowing Dining's own "gaststätte" keyword since Bills is
    //     checked first. Same reasoning: "gas" has no boundary before the
    //     embedded occurrence in "Gaststätte" ("...GAS-tstätte", no break
    //     between "gas" and the following "t"), so `\bgas\b` resolves it.
    //     To avoid a foreseeable new regression, common fused German gas
    //     compounds that would ALSO lose their word boundary under this
    //     change ("Erdgas", "GASAG") are kept as explicit bare-substring
    //     keywords below rather than silently dropped.
    category: "Bills",
    keywords: [
      "stadtwerke",
      "vattenfall",
      "eon",
      "telekom",
      "vodafone",
      "o2",
      "1&1",
      "versicherung",
      "insurance",
      // Named insurer — added alongside the Travel-rule "swiss" narrowing
      // (see the note there) so a genuine Swiss Life premium still resolves
      // to Bills even when the description itself doesn't also contain a
      // generic word like "Versicherung" (which would already route to
      // Bills on its own, before Travel is even checked).
      "swiss life",
      "strom",
      "gasag",
      "erdgas",
      "wasser",
      "internet",
      "telefon",
      "rundfunk",
      "gez",
      "ard zdf",
      "beitragsservice",
    ],
    wholeWordKeywords: ["rwe", "gas"],
  },
  {
    // Bare "ticket" (removed, not narrowed) was a substring of "Flugticket"
    // (plane ticket, no operator name present), keeping genuine flights in
    // Transport instead of Travel. This is structurally identical to the
    // "rent" collision, not the "wohnung" one: German transit fares are
    // routinely fused compounds with NO word boundary before "ticket"
    // ("Tagesticket", "Einzelticket", "Deutschlandticket", ...) — the exact
    // same shape as the "Flugticket" collision — so `wholeWordKeywords`
    // alone cannot tell a genuine transit ticket apart from a flight
    // ticket; both would fail (if strict) or both would pass (if bare
    // substring). Resolved instead by enumerating the known genuine
    // transit-ticket compounds explicitly below (so they keep matching as
    // bare substrings) while using `wholeWordKeywords` only for the
    // standalone word "ticket" (e.g. "BVG Ticket", "Ticket Automat"),
    // which correctly excludes "Flugticket" (no boundary) without
    // excluding the enumerated compounds (matched separately, as
    // substrings). Trade-off: a not-yet-seen fused "-ticket" transit
    // compound outside this list would no longer match on "ticket" alone —
    // low risk in practice since real transit-ticket descriptions almost
    // always co-occur with an operator keyword already in this list
    // ("bvg", "mvg", "hvv", "bahn", ...).
    category: "Transport",
    keywords: [
      "deutsche bahn",
      "db vertrieb",
      "db ",
      "bahn",
      "bvg",
      "mvg",
      "hvv",
      "vrs",
      "vrr",
      "rmv",
      "vbb",
      "verkehrsbetriebe",
      "flixbus",
      "uber",
      "bolt",
      "freenow",
      "free now",
      "tier",
      "lime",
      "shell",
      "aral",
      "total",
      "esso",
      "tankstelle",
      "car2go",
      "share now",
      "sixt",
      "taxi",
      "fahrkarte",
      "bahnticket",
      "tagesticket",
      "einzelticket",
      "wochenticket",
      "monatsticket",
      "jahresticket",
      "kurzstreckenticket",
      "gruppenticket",
      "deutschlandticket",
      "9-euro-ticket",
      "nahverkehrsticket",
    ],
    wholeWordKeywords: ["ticket"],
  },
  {
    // Travel is intentionally placed AFTER Transport (and after Groceries /
    // Rent / Bills) in this list. `classifyTransaction` returns the FIRST
    // matching rule, so keeping Travel here guarantees none of the
    // above categories can regress — they always get first refusal.
    //
    // Known keyword collisions with EARLIER rules, and how they were
    // resolved (kept out of this list rather than duplicated, since a
    // duplicate here would just be unreachable dead code):
    //   - "sixt"    -> already a Transport keyword (Sixt car-sharing /
    //                  "Share Now" style short urban rides). Transport is
    //                  checked first, so genuine long-distance Sixt rental
    //                  car bookings will still land in Transport, not
    //                  Travel. Accepted trade-off to avoid reclassifying
    //                  everyday car-sharing trips as "Travel".
    //   - "flixbus" -> already a Transport keyword for the same reason
    //                  (intercity coach used for commuting too).
    //   - "db fernverkehr" -> Transport's generic "db " keyword already
    //                  matches this substring, so it would never reach
    //                  this rule. Not added here to avoid dead/misleading
    //                  config; Deutsche Bahn traffic (commuter or long
    //                  distance) intentionally stays under Transport.
    //   - "ferienwohnung" -> previously shadowed by the Rent rule's bare
    //                  "wohnung" keyword (Rent is checked before Travel),
    //                  so a real "Ferienwohnung" booking classified as
    //                  Rent instead of Travel. Fixed: Rent's "wohnung" is
    //                  now a whole-word-only match (see `wholeWordKeywords`
    //                  on the Rent rule), which does not match inside the
    //                  compound word "ferienwohnung" (no word boundary
    //                  between "ferien" and "wohnung" in a single fused
    //                  word), so "ferienwohnung" is now listed explicitly
    //                  below and reaches this rule.
    //
    // Also note: "hrs" (the German hotel booking platform) was deliberately
    // narrowed to "hrs.de" — the bare 3-letter token is a substring of
    // unrelated German words (e.g. "Fahrschule" contains "...fa-HRS-chule"),
    // which would have created a new false-positive classification.
    //
    // "swiss" (removed, not narrowed): bare "swiss" matches "Swiss Life AG",
    // a German life-insurance provider, so a genuine insurance premium was
    // classifying as Travel instead of Bills. This is the same shape of
    // collision as "rent": "Swiss" is a genuine standalone word in both
    // "SWISS International Air Lines" and "Swiss Life AG", so
    // `wholeWordKeywords` (word-boundary matching) cannot distinguish them
    // — both are already whole words. Resolved the same way as "rent": by
    // matching specific phrases the airline actually uses in transaction
    // text ("swiss air", "swiss international"/"swiss intl", "swiss.com")
    // rather than the bare word, none of which appear in "Swiss Life AG".
    // A "swiss life" keyword was also added to the Bills rule above so a
    // genuine Swiss Life premium still resolves correctly rather than
    // merely stopping at "not Travel" (falling through to "Other").
    //
    // "enterprise" (narrowed to "enterprise rent"/"enterprise-rent"): the
    // bare word is generic English business vocabulary (e.g. "Enterprise
    // License", "Enterprise Agreement") that has nothing to do with car
    // rental. Enterprise Rent-A-Car's own naming always includes
    // "Rent"/"Rent-A-Car", so narrowing to that phrase (covering both the
    // space- and hyphen-separated forms seen on statements) keeps genuine
    // matches while dropping the generic false positives. Flagged as
    // low-confidence (no confirmed live collision seen in this app's data,
    // unlike the numbered list above) but applied since it mirrors the
    // existing "hrs.de" precedent in this same rule at negligible risk.
    category: "Travel",
    keywords: [
      // Airlines
      "lufthansa",
      "eurowings",
      "ryanair",
      "easyjet",
      "condor",
      "swiss air",
      "swiss international",
      "swiss intl",
      "swiss.com",
      "klm",
      "air france",
      "british airways",
      "turkish airlines",
      "wizz",
      // Booking platforms
      "booking.com",
      "airbnb",
      "expedia",
      "hotels.com",
      "trivago",
      "opodo",
      "check24 reise",
      "hrs.de",
      // Hotels / accommodation
      "hotel",
      "hostel",
      "pension",
      "resort",
      "motel",
      // Holiday flats — reachable now that Rent's "wohnung" is whole-word
      // only (see note above); "ferienwohnung" is unaffected by that
      // change since it's a full-word compound, not itself scoped.
      "ferienwohnung",
      // Rail / coach / ferry beyond commuting (kept clear of Transport's
      // "db ", "bahn" and "flixbus" keywords — see note above)
      "eurostar",
      "sncf",
      "trenitalia",
      "oebb",
      "sbb",
      // Car rental (kept clear of Transport's "sixt" — see note above)
      "europcar",
      "hertz",
      "avis",
      "enterprise rent",
      "enterprise-rent",
      "buchbinder",
      // German generic word for "rental car" — added so a genuine car-hire
      // transaction (e.g. "Check24 Mietwagen") actually resolves to Travel
      // now that Income's "wage" no longer swallows it (see the "wage"
      // note on the Income rule); without this it would fall through to
      // "Other" instead of being properly categorized. Unambiguous: no
      // other category legitimately uses this compound word.
      "mietwagen",
      // Travel-adjacent
      "reisebüro",
      "urlaub",
      "ferien",
      "tui",
      "dertour",
      "lastminute",
      "flughafen",
      "airport",
      "duty free",
      "mautgebühr",
      "vignette",
      // Generic plane-ticket wording with no airline name present (see the
      // "ticket" note on the Transport rule above — Transport's bare
      // "ticket" no longer matches this fused compound, so it must be
      // listed explicitly here to actually resolve to Travel).
      "flugticket",
      "flug ticket",
    ],
  },
  {
    category: "Dining",
    keywords: [
      "restaurant",
      "mcdonald",
      "burger king",
      "kfc",
      "subway",
      "starbucks",
      "coffee",
      "cafe",
      "café",
      "pizzeria",
      "lieferando",
      "deliveroo",
      "uber eats",
      "wolt",
      "pizza",
      "sushi",
      "nordsee",
      "vapiano",
      "gastronomie",
      "delivery hero",
      "bistro",
      "imbiss",
      "gaststätte",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      "netflix",
      "spotify",
      "amazon prime",
      "disney",
      "sky",
      "dazn",
      "apple music",
      "youtube premium",
      "youtube",
      "kino",
      "cinema",
      "theater",
      "konzert",
      "concert",
      "ticketmaster",
      "eventim",
      "steam",
      "playstation",
      "xbox",
      "nintendo",
      "gaming",
    ],
  },
  {
    // "tk " (with a manually-appended trailing space, used as an ad-hoc
    // word-boundary hack for the Techniker Krankenkasse abbreviation) is a
    // substring of the common German quantity abbreviation "Stk" (Stück,
    // "piece/qty") whenever followed by a space, e.g. an itemized purchase
    // description containing "3 Stk " would misclassify as Healthcare. It
    // also fails to match "TK" at the very end of a search string (no
    // trailing space there at all), an existing recall gap. Replaced with
    // the real `wholeWordKeywords` mechanism (`\btk\b`), which requires a
    // boundary on BOTH sides: it excludes "Stk" (no boundary before "tk")
    // while still matching standalone "TK" anywhere, including string end.
    category: "Healthcare",
    keywords: [
      "apotheke",
      "pharmacy",
      "arzt",
      "doctor",
      "zahnarzt",
      "dentist",
      "krankenhaus",
      "hospital",
      "klinik",
      "clinic",
      "aok",
      "barmer",
      "dak",
      "techniker krankenkasse",
      "krankenkasse",
      "fitnessstudio",
      "gym",
      "mcfit",
      "fitness first",
      "urban sports",
    ],
    wholeWordKeywords: ["tk"],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon",
      "zalando",
      "otto",
      "ebay",
      "mediamarkt",
      "saturn",
      "ikea",
      "h&m",
      "zara",
      "c&a",
      "primark",
      "decathlon",
      "obi",
      "bauhaus",
      "hornbach",
      "paypal",
      "klarna",
      "about you",
    ],
  },
  {
    category: "Subscriptions",
    keywords: [
      "abo",
      "subscription",
      "mitgliedsbeitrag",
      "membership",
      "mitgliedschaft",
      "patreon",
      "cloud",
      "icloud",
      "google storage",
      "classpass",
      "zeitschrift",
      "magazine",
      "monatlich",
      "monthly",
      "jahresbeitrag",
    ],
  },
  {
    // "wage" (removed, not narrowed as-is): bare "wage" is a substring of
    // German "Mietwagen" (car rental), so e.g. "Mietwagen Buchung" / "Check24
    // Mietwagen" was classifying as Income — turning an expense into
    // income and corrupting cash-flow / savings-rate figures. Unlike
    // "rent"/"swiss", "wage" has no standalone alternate meaning that
    // collides: it never appears as its own word inside "Mietwagen" (no
    // boundary before the embedded "wage", since it's preceded by "t" with
    // no break), so `\bwage\b` fully resolves the collision. Plural
    // "wages" is added back explicitly as a bare substring since it would
    // fail the whole-word check on "wage" alone (no trailing boundary
    // before the "s") — safe to add, it is not a substring of "Mietwagen".
    category: "Income",
    keywords: [
      "gehalt",
      "salary",
      "lohn",
      "wages",
      "überweisung",
      "rückerstattung",
      "refund",
      "erstattung",
      "bonus",
      "prämie",
      "einnahme",
      "gutschrift",
      "dividende",
    ],
    wholeWordKeywords: ["wage"],
  },
];

/**
 * Classifies a transaction into a category based on description and counterparty.
 */
export function classifyTransaction(
  description: string,
  counterparty: string
): Category {
  const searchText = `${description} ${counterparty}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const substringHit = rule.keywords.some((kw) => searchText.includes(kw));
    const wholeWordHit =
      rule.wholeWordKeywords?.some((kw) => matchesWholeWord(searchText, kw)) ??
      false;
    if (substringHit || wholeWordHit) {
      return rule.category;
    }
  }

  return "Other";
}

/**
 * Categorizes a transaction based on its direction and content.
 * Alias for classifyTransaction to match UnifiedTransaction interface.
 */
export function categorizeTransaction(
  transaction: UnifiedTransaction
): Category {
  // Prioritize Income for credit transactions
  if (transaction.direction === "credit" && transaction.amount > 0) {
    const searchText =
      `${transaction.description} ${transaction.counterparty}`.toLowerCase();
    const incomeRule = CATEGORY_RULES.find((r) => r.category === "Income");
    if (
      incomeRule &&
      incomeRule.keywords.some((kw) => searchText.includes(kw))
    ) {
      return "Income";
    }
    // Default positive amounts to Income if no specific keyword match
    return "Income";
  }

  return classifyTransaction(transaction.description, transaction.counterparty);
}

/**
 * Batch-classify an array of transactions.
 */
export function classifyTransactions(
  transactions: { description: string; counterparty: string }[]
): Category[] {
  return transactions.map((tx) =>
    classifyTransaction(tx.description, tx.counterparty)
  );
}

// --- Recurring Transaction Detection ---

export interface RecurringTransactionGroup {
  counterparty: string;
  transactions: UnifiedTransaction[];
  averageAmount: number;
  averageInterval: number; // in days
  category: Category;
}

/**
 * Detects recurring transactions based on:
 * - Same counterparty
 * - Similar amount (within 10%)
 * - Regular intervals (28-32 days, typical monthly billing)
 *
 * Returns groups of recurring transactions sorted by frequency.
 */
export function detectRecurring(
  transactions: UnifiedTransaction[]
): RecurringTransactionGroup[] {
  // Group transactions by counterparty
  const byCounterparty = new Map<string, UnifiedTransaction[]>();

  for (const tx of transactions) {
    const key = tx.counterparty.trim().toLowerCase();
    if (!key) continue; // Skip transactions without counterparty

    if (!byCounterparty.has(key)) {
      byCounterparty.set(key, []);
    }
    byCounterparty.get(key)!.push(tx);
  }

  const recurringGroups: RecurringTransactionGroup[] = [];

  // Analyze each counterparty group
  for (const [, txs] of byCounterparty.entries()) {
    if (txs.length < 3) continue; // Need at least 3 transactions to detect pattern

    // Sort by date
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Find clusters of similar amounts (within 10%)
    const clusters = findAmountClusters(sorted, 0.1);

    for (const cluster of clusters) {
      if (cluster.length < 3) continue; // Need at least 3 for recurring pattern

      // Check if intervals are regular (28-32 days)
      const intervals = calculateIntervals(cluster);
      const regularIntervals = intervals.filter((i) => i >= 28 && i <= 32);

      if (regularIntervals.length >= 2) {
        // At least 2 regular intervals = recurring pattern
        const avgAmount =
          cluster.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) /
          cluster.length;
        const avgInterval =
          regularIntervals.reduce((sum, i) => sum + i, 0) /
          regularIntervals.length;

        recurringGroups.push({
          counterparty: cluster[0].counterparty,
          transactions: cluster,
          averageAmount: avgAmount,
          averageInterval: avgInterval,
          category: categorizeTransaction(cluster[0]),
        });
      }
    }
  }

  // Sort by number of occurrences (descending)
  return recurringGroups.sort(
    (a, b) => b.transactions.length - a.transactions.length
  );
}

/**
 * Groups transactions into clusters based on similar amounts (within tolerance)
 */
function findAmountClusters(
  transactions: UnifiedTransaction[],
  tolerance: number
): UnifiedTransaction[][] {
  const clusters: UnifiedTransaction[][] = [];

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    let foundCluster = false;

    // Try to add to existing cluster
    for (const cluster of clusters) {
      const clusterAvg =
        cluster.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
        cluster.length;
      const diff = Math.abs(amount - clusterAvg) / clusterAvg;

      if (diff <= tolerance) {
        cluster.push(tx);
        foundCluster = true;
        break;
      }
    }

    // Create new cluster if no match
    if (!foundCluster) {
      clusters.push([tx]);
    }
  }

  return clusters;
}

/**
 * Calculates intervals (in days) between consecutive transactions
 */
function calculateIntervals(transactions: UnifiedTransaction[]): number[] {
  const intervals: number[] = [];

  for (let i = 1; i < transactions.length; i++) {
    const prevDate = new Date(transactions[i - 1].date);
    const currDate = new Date(transactions[i].date);
    const diffMs = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    intervals.push(diffDays);
  }

  return intervals;
}
