import { visitorT } from "@/lib/locale";
import { Footer, LangLinks, Logo } from "@/components/ui";
import { BUSINESS, retentionMonths } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Privacy policy (Hebrew and English; other languages see English). Draft to be reviewed by a lawyer. */
export default async function Privacy() {
  const { locale, t } = await visitorT();
  const he = locale === "he";
  const m = retentionMonths();
  const S = he
    ? [
        ["מי אנחנו", `Hirewise מבית Clearwise מופעלת על ידי ${BUSINESS.name}, ${BUSINESS.address}. לפניות: ${BUSINESS.email}.`],
        ["תפקידים", "לגבי מידע של מועמדים, המעסיק שיצר את המבחן הוא בעל השליטה במידע, ו-Hirewise מעבדת אותו בשמו ולפי הוראותיו. לגבי פרטי חשבון המעסיק, Hirewise היא בעלת השליטה."],
        ["מה נאסף", "ממעסיקים: מייל, שם, שם החברה, מייל ליצירת קשר, תיאור התפקיד ותשובות שאלון המנהל, והיסטוריית רכישות (פרטי כרטיס האשראי נמסרים ישירות לחברת הסליקה ואינם נשמרים אצלנו). ממועמדים: שם, מייל, טלפון (לא חובה), שפה, בקשה להארכת זמן, התשובות, זמני המענה, ומספר היציאות מהחלון וניסיונות ההדבקה."],
        ["למה", "כדי להפעיל את המבחן, להכין דו״ח למעסיק ולשלוח הודעות הכרחיות (קישור כניסה, הודעה שמועמד סיים). לא משתמשים במידע לפרסום, לא מוכרים אותו, ולא משתמשים בו לאימון מודלים."],
        ["בינה מלאכותית", "התשובות מנותחות בעזרת מודל של Anthropic (Claude) כדי להכין סיכום, ציונים ושאלות לראיון. הדו״ח הוא כלי תומך בלבד: ההחלטה על גיוס מתקבלת על ידי אדם. המערכת אינה מסיקה ואינה שוקלת תכונות מוגנות, וחוסמת ניסוחים מפלים מצד המעסיק. מועמד רשאי לבקש מהמעסיק הסבר, בדיקה של אדם, או להשיג על ההחלטה."],
        ["ספקים", "Cloudflare (אחסון ושרתים), Anthropic (ניתוח בבינה מלאכותית), Resend (מיילים), Grow ו-Paddle (סליקה). המידע עשוי לעבור לשרתים מחוץ לישראל ולאזור הכלכלי האירופי, בכפוף להתחייבויות הגנה מתאימות."],
        ["שמירה ומחיקה", `נתוני מועמדים נמחקים אוטומטית אחרי ${m} חודשים. מעסיק יכול למחוק מועמד או את כל החשבון בכל עת. מועמד שרוצה עותק, תיקון או מחיקה יכול לפנות למעסיק (המייל מופיע בדף המבחן) או אלינו.`],
        ["עוגיות", "רק עוגיות הכרחיות: כניסה לחשבון, המשך מבחן ושפה. אין עוגיות פרסום או מעקב."],
        ["זכויות", "לפי חוק הגנת הפרטיות, ה-GDPR וחוקים דומים: עיון, תיקון, מחיקה, הגבלה, ניוד והתנגדות, וזכות לפנות לרשות הגנת הפרטיות או לרשות הפיקוח במדינתכם."],
      ]
    : [
        ["Who we are", `Hirewise by Clearwise is operated by ${BUSINESS.name}, ${BUSINESS.address}. Contact: ${BUSINESS.email}.`],
        ["Roles", "For candidate data, the employer who created the assessment is the controller and Hirewise processes it on the employer's behalf and instructions. For employer account data, Hirewise is the controller."],
        ["What we collect", "From employers: email, name, company, contact email, the role description and manager questionnaire, and purchase history (card details go directly to the payment provider and are never stored by us). From candidates: name, email, phone (optional), language, an extended-time request, their answers, answer times, and the number of times they left the window or tried to paste."],
        ["Why", "To run the assessment, prepare the employer's report and send necessary messages (login links, completion alerts). We never use the data for advertising, never sell it, and never use it to train models."],
        ["AI", "Answers are analysed with a model from Anthropic (Claude) to prepare a summary, scores and interview questions. The report is decision support only: hiring decisions are made by a person. The system does not infer or weigh protected characteristics and blocks discriminatory criteria from employers. Candidates may ask the employer for an explanation or human review, and may contest a decision (GDPR Art. 22)."],
        ["Processors", "Cloudflare (hosting), Anthropic (AI analysis), Resend (email), Grow and Paddle (payments). Data may be transferred outside Israel and the EEA under appropriate safeguards."],
        ["Retention and deletion", `Candidate data is deleted automatically after ${m} months. Employers can delete a candidate or their whole account at any time. Candidates who want a copy, correction or deletion can contact the employer (shown on the assessment page) or us.`],
        ["Cookies", "Only necessary cookies: account login, continuing an assessment, and language. No advertising or tracking cookies."],
        ["Your rights", "Under the GDPR, UK GDPR, Israel's Privacy Protection Law and similar laws: access, rectification, erasure, restriction, portability and objection, and the right to complain to your data protection authority."],
      ];
  return (
    <div>
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4"><Logo /><LangLinks current={locale} next="/privacy" /></header>
      <main dir={he ? "rtl" : "ltr"} className="mx-auto max-w-3xl px-5">
        <div className="card space-y-5 p-6">
          <h1 className="h1">{t("privacy")}</h1>
          {S.map(([h, p]) => (
            <section key={h}><h2 className="font-bold">{h}</h2><p className="mt-1 text-sm leading-relaxed text-ink/75">{p}</p></section>
          ))}
          <p className="text-xs text-ink/45">{he ? "עודכן: נובמבר 2026" : "Updated: November 2026"}</p>
        </div>
      </main>
      <Footer t={t} />
    </div>
  );
}
