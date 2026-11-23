/**
 * Jurisdiction-aware compliance guard for the employer's role and culture inputs.
 * Step 1 (here, instant): a multi-language keyword scan for protected characteristics.
 * Step 2 (in ai.ts): only when step 1 finds something, the AI judges the phrase in context
 *   ("experience working with children" is fine; "no mothers of young children" is not).
 * If the AI is unavailable, every keyword hit blocks, so the guard fails closed.
 */
export const JURISDICTIONS = ["IL", "US", "EU", "UK", "GLOBAL"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];
export const isJurisdiction = (j: unknown): j is Jurisdiction => JURISDICTIONS.includes(j as Jurisdiction);

export const CATEGORIES = ["age", "sex", "family", "religion", "origin", "disability", "orientation", "military", "politics"] as const;
export type Category = (typeof CATEGORIES)[number];

/** The laws each jurisdiction's guard is based on (shown to the employer) */
export const LEGAL_BASIS: Record<Jurisdiction, string> = {
  IL: "Equal Employment Opportunities Law, 1988 (חוק שוויון ההזדמנויות בעבודה)",
  US: "Title VII, ADEA, ADA, GINA, USERRA (EEOC)",
  EU: "Directives 2000/78/EC & 2006/54/EC, GDPR Art. 22, EU AI Act (high-risk: employment)",
  UK: "Equality Act 2010, UK GDPR Art. 22",
  GLOBAL: "ILO Convention 111 and the strictest common rules of IL, US, EU and UK",
};

// Hebrew words often carry a 1-2 letter prefix (ו, ה, ב, ל, ש, מ, כ)
const HE = "(?:[ובלהשמכ]{0,2})";
const TERMS: Record<Category, string[]> = {
  age: [
    "young", "younger", "youthful", "under \\d{2}", "over \\d{2}", "aged \\d{2}", "years old", "no older than", "digital natives?", "recent graduates?", "millennials?", "gen z",
    `${HE}צעיר(?:ה|ים|ות)?`, `${HE}גיל`, `${HE}מבוגר(?:ת|ים|ות)?`, "עד גיל", "joven(?:es)?", "edad", "jeunes?", "âge", "jung(?:e|en)?", "alter", "شاب", "شباب", "عمر", "سن",
  ],
  sex: [
    "male", "female", "man", "men", "woman", "women", "guys?", "girls?", "lad(?:y|ies)", "gentlem[ae]n",
    `${HE}גבר(?:ים)?`, `${HE}אישה`, `${HE}נשים`, `${HE}בחור(?:ה|ים|ות)?`, "mujer(?:es)?", "hombres?", "femmes?", "hommes?", "frauen?", "männer", "mann", "امرأة", "نساء", "رجل", "رجال",
  ],
  family: [
    "pregnan\\w*", "maternity", "children", "kids", "married", "marital", "family plans?", "childless", "spouse",
    `${HE}הריון`, `${HE}הרה`, `${HE}ילדים`, `${HE}נשו(?:י|אה|אים)`, `${HE}רווק(?:ה)?`, "מצב משפחתי", "חופשת לידה", "embarazad[ao]s?", "casad[ao]s?", "hijos", "enceintes?", "mariée?s?", "enfants", "schwanger", "verheiratet", "kinder", "حامل", "متزوج(?:ة)?", "أطفال",
  ],
  religion: [
    "religio\\w*", "church", "mosque", "synagogue", "christians?", "muslims?", "jewish", "jews", "hindus?", "atheists?", "sabbath", "shabbat",
    `${HE}דתי(?:ה|ים|ות)?`, `${HE}חילוני(?:ה|ים|ות)?`, `${HE}חרדי(?:ה|ים|ות)?`, `${HE}דת`, "שומר(?:ת)? שבת", `${HE}מוסלמי(?:ם)?`, `${HE}נוצרי(?:ם)?`, "religión", "religiosos?", "religieux", "religion", "religiös", "دين", "ديانة", "مسلم", "مسيحي",
  ],
  origin: [
    "race", "racial", "ethnic\\w*", "nationality", "native speakers?", "native[- ]born", "skin colou?r", "accent",
    `${HE}ערבי(?:ה|ים|יות)?`, `${HE}אתיופי(?:ם)?`, `${HE}מוצא`, `${HE}לאום`, `${HE}עדה`, "עול(?:ה|ים) חדש(?:ה|ים)?", "שפת אם", "raza", "étnico", "origen", "origine", "ethnie", "herkunft", "muttersprachler", "عرق", "جنسية", "أصل",
  ],
  disability: [
    "disab\\w*", "handicap\\w*", "healthy", "health (?:issues|problems)", "wheelchair", "mental illness", "chronic", "able[- ]bodied",
    `${HE}מוגבלות`, `${HE}נכ(?:ה|ות|ים)`, `${HE}בריא(?:ה|ים|ות)?`, "בעיות בריאות", "discapacidad", "sano", "handicapé", "behinderung", "gesund", "إعاقة", "معاق", "صحي",
  ],
  orientation: ["gay", "lesbian", "straight", "transgender", "lgbt\\w*", "sexual orientation", `${HE}הומו`, `${HE}לסבית`, "נטייה מינית", `${HE}טרנס`, "orientación sexual", "orientation sexuelle", "sexuelle orientierung", "مثلي"],
  military: [
    "reserve duty", "reservists?", "military service", "veterans?", "national service",
    `${HE}מילואים`, "שירות צבאי", "פטור משירות", `${HE}צבא`, "servicio militar", "service militaire", "wehrdienst", "خدمة عسكرية",
  ],
  politics: ["political", "politics", "party member\\w*", "trade unions?", "union member\\w*", `${HE}פוליטי(?:ת)?`, `${HE}מפלגה`, "ועד עובדים", `${HE}איגוד`, "político", "politique", "politisch", "gewerkschaft", "سياسي"],
};

const PATTERNS: { cat: Category; re: RegExp }[] = CATEGORIES.map((cat) => ({
  cat,
  re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${TERMS[cat].join("|")})(?![\\p{L}\\p{N}])`, "giu"),
}));

export type Hit = { field: string; category: Category; term: string };

/** Instant keyword scan. Returns one hit per (field, category, term). */
export function scan(fields: Record<string, string>): Hit[] {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const [field, raw] of Object.entries(fields)) {
    const text = String(raw || "");
    if (!text.trim()) continue;
    for (const { cat, re } of PATTERNS) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const term = m[0];
        const k = `${field}|${cat}|${term.toLowerCase()}`;
        if (!seen.has(k)) {
          seen.add(k);
          hits.push({ field, category: cat, term });
        }
      }
    }
  }
  return hits;
}

/** Instructions given to the AI wherever it writes questions or evaluates candidates */
export function complianceRules(j: Jurisdiction): string {
  return `Legal frame: ${LEGAL_BASIS[j]}.
Never ask about, infer, mention or weigh any protected characteristic: age, sex or gender identity, pregnancy, parenthood or marital status, religion or belief, race, ethnicity, national origin, accent, native language, disability or health, sexual orientation, military or reserve service, political opinion, union membership, genetic information, place of residence.
Judge only job-related behaviour: how the person reasons, prioritises, communicates and acts in the situations described.`;
}
