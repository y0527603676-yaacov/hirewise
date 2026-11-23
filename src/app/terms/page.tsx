import { visitorT } from "@/lib/locale";
import { Footer, LangLinks, Logo } from "@/components/ui";
import { BUSINESS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Terms of use (Hebrew and English). Draft to be reviewed by a lawyer. */
export default async function Terms() {
  const { locale, t } = await visitorT();
  const he = locale === "he";
  const S = he
    ? [
        ["השירות", "Hirewise מאפשרת למעסיקים ליצור מבחני מצבי עבודה ולקבל דו״ח שנעזר בבינה מלאכותית. הדו״ח הוא כלי תומך החלטה ואינו ממליץ על קבלה או דחייה."],
        ["אחריות המעסיק", "המעסיק אחראי להחלטות הגיוס שלו ולעמידה בדיני העבודה, השוויון והפרטיות במדינתו, כולל יידוע המועמדים ומתן אפשרות לבדיקה של אדם. אסור להשתמש בדו״ח כבסיס יחיד לדחיית מועמד, ואסור לנסות לעקוף את מנגנון החסימה של קריטריונים מפלים."],
        ["קרדיטים ותשלום", "כל דו״ח שנפתח צורך קרדיט אחד. שני הדו״חות הראשונים בחינם, פעם אחת לכל כתובת מייל. קרדיטים שנרכשו אינם פגים. ביטול רכישה של חבילה שלא נוצל ממנה אף קרדיט אפשרי תוך 14 יום, לפי חוק הגנת הצרכן; אחרי ניצול לא יינתן החזר יחסי, אלא אם החוק מחייב אחרת. דו״ח שהכנתו נכשלה אינו מחויב."],
        ["שימוש הוגן", "אסור לשתף קישורי מבחן לצורך שאינו גיוס אמיתי, לאסוף מידע מעבר לנדרש או להעלות תוכן פוגעני."],
        ["הגבלת אחריות", "השירות ניתן כמות שהוא. איננו אחראים לנזק עקיף או לתוצאה של החלטת גיוס. האחריות הכוללת מוגבלת לסכום ששולם ב-12 החודשים האחרונים."],
        ["יצירת קשר", `${BUSINESS.name}, ${BUSINESS.address}. ${BUSINESS.email}.`],
      ]
    : [
        ["The service", "Hirewise lets employers create work-scenario assessments and receive an AI-assisted report. The report is decision support and never recommends hiring or rejecting."],
        ["Employer responsibility", "Employers are responsible for their hiring decisions and for complying with employment, equality and privacy laws in their country, including informing candidates and offering human review. Do not use a report as the sole basis for rejecting a candidate, and do not try to bypass the discrimination guard."],
        ["Credits and payment", "Each opened report uses one credit. The first two reports are free, once per email address. Purchased credits do not expire. An unused pack can be refunded within 14 days of purchase; used credits are not refunded pro rata unless the law requires it. A report that fails to generate is never charged. International payments are processed by Paddle as merchant of record."],
        ["Fair use", "Assessment links may only be used for genuine hiring. Do not collect more data than needed or upload offensive content."],
        ["Liability", "The service is provided as is. We are not liable for indirect damages or for the outcome of any hiring decision. Total liability is limited to the amount paid in the previous 12 months."],
        ["Contact", `${BUSINESS.name}, ${BUSINESS.address}. ${BUSINESS.email}.`],
      ];
  return (
    <div>
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4"><Logo /><LangLinks current={locale} next="/terms" /></header>
      <main dir={he ? "rtl" : "ltr"} className="mx-auto max-w-3xl px-5">
        <div className="card space-y-5 p-6">
          <h1 className="h1">{t("terms")}</h1>
          {S.map(([h, p]) => (
            <section key={h}><h2 className="font-bold">{h}</h2><p className="mt-1 text-sm leading-relaxed text-ink/75">{p}</p></section>
          ))}
        </div>
      </main>
      <Footer t={t} />
    </div>
  );
}
