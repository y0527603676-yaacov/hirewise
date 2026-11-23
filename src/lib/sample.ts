/** A complete, realistic sample (role, questions, answers, report) for the public sample page and the demo seed */
import type { AssessmentContent, ReportContent } from "./core/schemas";

type Sample = {
  job: { title: string; department: string; responsibilities: string; requiredSkills: string; teamDynamics: string; criticalTraits: string; nonNegotiables: string; behavioralRedLines: string };
  assessment: AssessmentContent;
  candidate: string;
  answers: Record<string, string>;
  seconds: number[];
  report: ReportContent;
};

const en: Sample = {
  job: {
    title: "Customer Success Team Lead",
    department: "Customer Success",
    responsibilities: "Lead a team of 6 support agents, own escalations from key accounts, keep response times under 2 hours, report weekly to the VP Operations.",
    requiredSkills: "3+ years in customer support, at least 1 year leading people, clear written communication, CRM experience.",
    teamDynamics: "Small team that moves fast; decisions are made in a short daily stand-up; disagreements are raised openly with the manager.",
    criticalTraits: "Owns mistakes, updates the manager early about risks, stays calm with angry customers, protects the team from burnout.",
    nonNegotiables: "Never promises a customer a fix date without confirming with the product team.",
    behavioralRedLines: "Hides problems, blames team members in front of customers.",
  },
  assessment: {
    intro: "Five short situations from the first months in this role. There are no trick questions — tell us what you would really do.",
    questions: [
      { id: "q1", kind: "scenario", title: "The angry key account", competency: "Customer handling", timeLimitSec: 180, scenario: "It's 16:40. The operations director of your largest customer calls, furious: their invoices have been failing to sync for two days and their month-end close is tomorrow. One of your agents told them yesterday that it would be fixed \"today\". The product team says the root cause is still unknown.", prompt: "What exactly do you do in the next hour, and why?", criteria: [{ name: "Honesty", lookFor: "Does not repeat an unconfirmed fix date; corrects the earlier promise." }, { name: "Ownership", lookFor: "Takes personal ownership and sets a concrete next update time." }, { name: "Workaround", lookFor: "Looks for a manual workaround for tomorrow's close." }] },
      { id: "q2", kind: "scenario", title: "Your own mistake", competency: "Accountability", timeLimitSec: 150, scenario: "On Monday you sent the weekly report to the VP. On Wednesday you notice that you counted resolved tickets twice: the real resolution rate is 71%, not the 86% you reported. The VP already quoted your number in a board update.", prompt: "What do you do, and how do you phrase it?", criteria: [{ name: "Speed", lookFor: "Tells the VP the same day, before being asked." }, { name: "Clarity", lookFor: "States the correct figure, the cause and the fix to the process." }] },
      { id: "q3", kind: "scenario", title: "Burnout on the team", competency: "People leadership", timeLimitSec: 150, scenario: "Dana, your strongest agent, has handled most escalations for three weeks. She starts answering curtly, and yesterday she left early without telling anyone. Two big customers ask for her by name.", prompt: "How do you handle this over the next few days?", criteria: [{ name: "Care", lookFor: "Talks to Dana privately and early, listens before deciding." }, { name: "Load", lookFor: "Redistributes escalations and builds backup skills in the team." }] },
      { id: "q4", kind: "scenario", title: "Speed versus quality", competency: "Judgement under pressure", timeLimitSec: 150, scenario: "Response times have crept up to 3.5 hours. The VP asks you to bring them under 2 hours by next week. One agent suggests sending a templated first reply to every ticket immediately, even before reading it properly.", prompt: "What do you decide, and what do you tell the VP?", criteria: [{ name: "Trade-off", lookFor: "Weighs speed against real quality, doesn't game the metric." }, { name: "Plan", lookFor: "Proposes concrete levers (triage, staffing, macros for known issues)." }] },
      { id: "q5", kind: "scenario", title: "A blame moment", competency: "Integrity", timeLimitSec: 120, scenario: "On a call with a customer and your manager, the customer complains about a wrong answer they got last week. Your manager asks \"who gave this answer?\". You know it was Omer, a new agent who followed an outdated help article.", prompt: "What do you say on the call, and what do you do afterwards?", criteria: [{ name: "Team protection", lookFor: "Does not name or blame Omer in front of the customer." }, { name: "Systemic fix", lookFor: "Fixes the outdated article and coaches Omer privately." }] },
    ],
  },
  candidate: "Maya Levin",
  answers: {
    q1: "First I call the director back myself, within 10 minutes. I apologise and correct what my agent said: we don't have a fix date yet and I won't give one I can't keep. I tell her I'm personally owning this until it's solved and that she'll hear from me at 18:00 even if there's no news. Then I sit with product to find a manual workaround for tomorrow — e.g. exporting the invoices to CSV so her team can import them manually for the close. After that I talk with the agent privately about not promising dates.",
    q2: "I'd tell the VP today, before the board follow-up gets worse. Short message: 'I made an error in Monday's report — resolved tickets were double counted. The correct rate is 71%, not 86%. I've fixed the query and added a check so it can't happen again. Sorry for the trouble — I can prepare a corrected slide for the board if useful.' Then I'd send the corrected report.",
    q3: "I'd talk to Dana one on one the same day, not in front of the team. Ask how she's doing and listen. I'd tell her I see how much she's carrying and that it's on me to fix it. Then I'd move half of the escalations to two other agents with me shadowing them, and tell the two customers that a colleague is joining Dana on their account. Leaving early without telling anyone I'd mention gently, but the main issue is the load.",
    q4: "I wouldn't do the templated reply without reading — it makes the number look good but customers will feel ignored. I'd tell the VP I can get to 2 hours in two weeks, not one, and show the plan: triage at the start of each shift, macros only for the 5 most common known issues, and moving one agent to the evening peak. If he insists on next week, I'd ask for one temporary agent.",
    q5: "On the call I'd say: 'That answer came from our team and it was wrong — I take responsibility. Here's the correct information.' After the call I'd tell my manager privately what happened, update the outdated article the same day, and go over it with Omer without making him feel blamed. Then check if other articles are outdated too.",
  },
  seconds: [168, 121, 133, 140, 97],
  report: {
    overallScore: 84, competenceScore: 82, cultureFitScore: 86, reliabilityScore: 88,
    executiveSummary: "Maya shows mature, customer-centred judgement and consistently takes ownership without passing blame. She corrects bad promises quickly, reports her own mistakes proactively, and protects her team while fixing root causes. The main open question is how she manages upward when timelines conflict with senior requests — worth probing in the interview.",
    strengths: [
      { title: "Takes ownership and corrects false promises", evidence: "I apologise and correct what my agent said: we don't have a fix date yet and I won't give one I can't keep." },
      { title: "Reports her own mistakes proactively", evidence: "I'd tell the VP today, before the board follow-up gets worse." },
      { title: "Protects the team in front of customers", evidence: "That answer came from our team and it was wrong — I take responsibility." },
      { title: "Fixes root causes, not just symptoms", evidence: "Update the outdated article the same day… then check if other articles are outdated too." },
    ],
    redFlags: [{ title: "May push back on deadlines rather than find a way to meet them", evidence: "I can get to 2 hours in two weeks, not one.", severity: "low" }],
    recommendedInterviewQuestions: [
      { question: "Tell me about a time a senior manager insisted on a deadline you thought was unrealistic. What happened?", why: "Probes the one low-severity flag: managing upward under pressure." },
      { question: "How did you build backup skills in a team that depended on one strong person?", why: "Checks whether her plan for Dana is based on real experience." },
      { question: "Walk me through how you'd measure quality alongside response time.", why: "Tests depth behind her refusal to game the metric." },
    ],
    perQuestion: [
      { id: "q1", score: 88, note: "Corrects the false promise, sets a firm update time, finds a practical workaround." },
      { id: "q2", score: 90, note: "Same-day disclosure with the correct figure, cause and prevention." },
      { id: "q3", score: 80, note: "Private, caring conversation and concrete load redistribution." },
      { id: "q4", score: 76, note: "Refuses to game the metric with a sound plan; renegotiates the timeline." },
      { id: "q5", score: 87, note: "Shields the new agent publicly and fixes the source of the error." },
    ],
    integrityNote: "",
  },
};

const he: Sample = {
  job: {
    title: "ראש צוות שירות לקוחות",
    department: "הצלחת לקוחות",
    responsibilities: "ניהול צוות של 6 נציגים, אחריות על הסלמות מלקוחות מפתח, זמן תגובה מתחת לשעתיים, דיווח שבועי לסמנכ״ל התפעול.",
    requiredSkills: "3 שנות ניסיון ומעלה בשירות לקוחות, שנה לפחות בניהול אנשים, כתיבה ברורה, ניסיון ב-CRM.",
    teamDynamics: "צוות קטן שזז מהר; החלטות מתקבלות בעמידה יומית קצרה; חילוקי דעות עולים בגלוי מול המנהל.",
    criticalTraits: "לוקח אחריות על טעויות, מעדכן את המנהל מוקדם על סיכונים, רגוע מול לקוחות כועסים, שומר על הצוות משחיקה.",
    nonNegotiables: "לא מבטיח ללקוח מועד תיקון בלי אישור מצוות המוצר.",
    behavioralRedLines: "מסתיר בעיות, מאשים חברי צוות מול לקוחות.",
  },
  assessment: {
    intro: "חמישה מצבים קצרים מהחודשים הראשונים בתפקיד. אין שאלות מכשילות: כתבו מה באמת הייתם עושים.",
    questions: [
      { id: "q1", kind: "scenario", title: "לקוח המפתח הכועס", competency: "טיפול בלקוחות", timeLimitSec: 180, scenario: "השעה 16:40. מנהלת התפעול של הלקוח הגדול ביותר שלכם מתקשרת, כועסת מאוד: החשבוניות שלהם לא מסתנכרנות כבר יומיים, ומחר סגירת החודש שלהם. אתמול אחד הנציגים שלכם אמר לה שזה יתוקן \"היום\". צוות המוצר אומר שהסיבה עדיין לא ידועה.", prompt: "מה בדיוק אתם עושים בשעה הקרובה, ולמה?", criteria: [{ name: "כנות", lookFor: "לא חוזר על מועד תיקון לא מאושר; מתקן את ההבטחה הקודמת." }, { name: "אחריות", lookFor: "לוקח אחריות אישית וקובע מועד עדכון מוגדר." }, { name: "פתרון עוקף", lookFor: "מחפש פתרון ידני לסגירה של מחר." }] },
      { id: "q2", kind: "scenario", title: "הטעות שלכם", competency: "אחריותיות", timeLimitSec: 150, scenario: "ביום שני שלחתם לסמנכ״ל את הדו״ח השבועי. ביום רביעי אתם מגלים שספרתם פניות שנסגרו פעמיים: שיעור הסגירה האמיתי הוא 71%, לא 86%. הסמנכ״ל כבר ציטט את המספר שלכם בעדכון להנהלה.", prompt: "מה אתם עושים, ואיך אתם מנסחים את זה?", criteria: [{ name: "מהירות", lookFor: "מעדכן את הסמנכ״ל באותו יום, לפני שנשאל." }, { name: "בהירות", lookFor: "מציג את הנתון הנכון, את הסיבה ואת התיקון בתהליך." }] },
      { id: "q3", kind: "scenario", title: "שחיקה בצוות", competency: "ניהול אנשים", timeLimitSec: 150, scenario: "דנה, הנציגה החזקה ביותר שלכם, מטפלת ברוב ההסלמות כבר שלושה שבועות. היא מתחילה לענות בקצרה, ואתמול יצאה מוקדם בלי לעדכן אף אחד. שני לקוחות גדולים מבקשים אותה בשמה.", prompt: "איך אתם מטפלים בזה בימים הקרובים?", criteria: [{ name: "אכפתיות", lookFor: "מדבר עם דנה בפרטיות ומוקדם, מקשיב לפני שמחליט." }, { name: "עומס", lookFor: "מחלק מחדש את ההסלמות ובונה גיבוי בצוות." }] },
      { id: "q4", kind: "scenario", title: "מהירות מול איכות", competency: "שיקול דעת תחת לחץ", timeLimitSec: 150, scenario: "זמן התגובה עלה ל-3.5 שעות. הסמנכ״ל מבקש להוריד אותו מתחת לשעתיים עד השבוע הבא. נציג מציע לשלוח מיד תשובה ראשונה קבועה לכל פנייה, עוד לפני שקוראים אותה כמו שצריך.", prompt: "מה אתם מחליטים, ומה אתם אומרים לסמנכ״ל?", criteria: [{ name: "איזון", lookFor: "שוקל מהירות מול איכות אמיתית, לא \"מייפה\" את המדד." }, { name: "תוכנית", lookFor: "מציע צעדים מעשיים (מיון, שיבוץ, תבניות לבעיות מוכרות)." }] },
      { id: "q5", kind: "scenario", title: "רגע של האשמה", competency: "יושרה", timeLimitSec: 120, scenario: "בשיחה עם לקוח ועם המנהל שלכם, הלקוח מתלונן על תשובה שגויה שקיבל בשבוע שעבר. המנהל שואל \"מי נתן את התשובה הזו?\". אתם יודעים שזה היה עומר, נציג חדש שפעל לפי מאמר עזרה לא מעודכן.", prompt: "מה אתם אומרים בשיחה, ומה אתם עושים אחריה?", criteria: [{ name: "הגנה על הצוות", lookFor: "לא מציין את עומר ולא מאשים אותו מול הלקוח." }, { name: "תיקון שורש", lookFor: "מתקן את המאמר הלא מעודכן ומדריך את עומר בפרטיות." }] },
    ],
  },
  candidate: "מאיה לוין",
  answers: {
    q1: "קודם כול אני חוזרת אליה בעצמי תוך עשר דקות. מתנצלת ומתקנת את מה שהנציג אמר: אין לנו עדיין מועד תיקון, ואני לא אתן מועד שאני לא יכולה לעמוד בו. אני אומרת לה שאני אחראית על זה אישית עד שזה ייפתר ושהיא תשמע ממני בשש גם אם אין חדש. אחר כך אני יושבת עם המוצר למצוא פתרון ידני למחר, למשל ייצוא החשבוניות לקובץ כדי שהצוות שלה ייבא אותן ידנית לסגירה. אחרי זה אני מדברת עם הנציג בפרטיות על הבטחת מועדים.",
    q2: "הייתי מעדכנת את הסמנכ״ל היום, לפני שהעדכון להנהלה מסתבך. הודעה קצרה: 'טעיתי בדו״ח של יום שני: פניות שנסגרו נספרו פעמיים. השיעור הנכון הוא 71%, לא 86%. תיקנתי את השאילתה והוספתי בדיקה כדי שזה לא יחזור. מצטערת על הטרחה, אוכל להכין שקף מתוקן להנהלה אם זה עוזר.' ואז שולחת את הדו״ח המתוקן.",
    q3: "הייתי מדברת עם דנה ביחידות באותו יום, לא מול הצוות. שואלת מה שלומה ומקשיבה. אומרת לה שאני רואה כמה היא סוחבת ושזה עליי לסדר. אחר כך מעבירה חצי מההסלמות לשני נציגים אחרים כשאני מלווה אותם, ומעדכנת את שני הלקוחות שעמית מצטרף לדנה בתיק שלהם. על היציאה המוקדמת בלי לעדכן הייתי מעירה בעדינות, אבל הבעיה העיקרית היא העומס.",
    q4: "לא הייתי עושה תשובה קבועה בלי לקרוא: זה מייפה את המספר, אבל הלקוחות ירגישו שמתעלמים מהם. הייתי אומרת לסמנכ״ל שאפשר להגיע לשעתיים בעוד שבועיים, לא שבוע, ומראה את התוכנית: מיון בתחילת כל משמרת, תבניות רק לחמש הבעיות המוכרות הנפוצות, והעברת נציג אחד לשיא של הערב. אם הוא מתעקש על השבוע הבא, הייתי מבקשת נציג זמני.",
    q5: "בשיחה הייתי אומרת: 'התשובה הזו יצאה מהצוות שלנו והיא הייתה שגויה, אני לוקחת אחריות. הנה המידע הנכון.' אחרי השיחה הייתי מספרת למנהל בפרטיות מה קרה, מעדכנת את המאמר באותו יום, ועוברת עליו עם עומר בלי שירגיש מואשם. ואז בודקת אם יש עוד מאמרים לא מעודכנים.",
  },
  seconds: [168, 121, 133, 140, 97],
  report: {
    overallScore: 84, competenceScore: 82, cultureFitScore: 86, reliabilityScore: 88,
    executiveSummary: "מאיה מפגינה שיקול דעת בוגר וממוקד לקוח, ולוקחת אחריות בעקביות בלי לגלגל אשמה. היא מתקנת הבטחות שגויות במהירות, מדווחת ביוזמתה על טעויות שלה, ומגנה על הצוות תוך תיקון שורש הבעיה. השאלה הפתוחה העיקרית היא איך היא מנהלת כלפי מעלה כשלוחות זמנים מתנגשים עם דרישות של הנהלה בכירה. כדאי לבדוק את זה בראיון.",
    strengths: [
      { title: "לוקחת אחריות ומתקנת הבטחות שגויות", evidence: "מתנצלת ומתקנת את מה שהנציג אמר: אין לנו עדיין מועד תיקון, ואני לא אתן מועד שאני לא יכולה לעמוד בו." },
      { title: "מדווחת ביוזמתה על הטעויות שלה", evidence: "הייתי מעדכנת את הסמנכ״ל היום, לפני שהעדכון להנהלה מסתבך." },
      { title: "מגנה על הצוות מול לקוחות", evidence: "התשובה הזו יצאה מהצוות שלנו והיא הייתה שגויה, אני לוקחת אחריות." },
      { title: "מתקנת את שורש הבעיה, לא רק את הסימפטום", evidence: "מעדכנת את המאמר באותו יום… ואז בודקת אם יש עוד מאמרים לא מעודכנים." },
    ],
    redFlags: [{ title: "עשויה להתנגד ללוח זמנים במקום לחפש דרך לעמוד בו", evidence: "אפשר להגיע לשעתיים בעוד שבועיים, לא שבוע.", severity: "low" }],
    recommendedInterviewQuestions: [
      { question: "ספרי על פעם שמנהל בכיר התעקש על מועד שחשבת שאינו מציאותי. מה קרה?", why: "בודק את הדגל היחיד, בחומרה נמוכה: ניהול כלפי מעלה תחת לחץ." },
      { question: "איך בנית גיבוי בצוות שהיה תלוי באדם חזק אחד?", why: "בודק אם התוכנית שלה לגבי דנה מבוססת על ניסיון אמיתי." },
      { question: "איך היית מודדת איכות לצד זמן תגובה?", why: "בודק את העומק שמאחורי הסירוב שלה \"לייפות\" את המדד." },
    ],
    perQuestion: [
      { id: "q1", score: 88, note: "מתקנת את ההבטחה השגויה, קובעת מועד עדכון ומוצאת פתרון מעשי." },
      { id: "q2", score: 90, note: "גילוי באותו יום, עם הנתון הנכון, הסיבה והמניעה." },
      { id: "q3", score: 80, note: "שיחה אישית ואכפתית, וחלוקת עומס מעשית." },
      { id: "q4", score: 76, note: "מסרבת לייפות את המדד ומציגה תוכנית סבירה; מבקשת להזיז את המועד." },
      { id: "q5", score: 87, note: "מגנה בפומבי על הנציג החדש ומתקנת את מקור הטעות." },
    ],
    integrityNote: "",
  },
};

export const sampleFor = (locale: string): Sample => (locale === "he" ? he : en);
export const SAMPLES = { en, he };
