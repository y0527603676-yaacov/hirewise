# Hirewise — מעריך מועמדים חכם (מבית Clearwise)

מבחן מצבי עבודה של 15 דקות לכל משרה, שהמועמד עונה עליו בשפה שלו, ודו״ח למעסיק בשפה של המעסיק.
Next.js (App Router) + TypeScript + Tailwind על Cloudflare Workers (OpenNext), מסד נתונים D1 דרך Drizzle, בינה מלאכותית של Anthropic, מיילים ב-Resend, תשלום ב-Grow (שקלים) וב-Paddle (חו״ל).

## הפעלה מקומית
```bash
npm install
cp .dev.vars.example .dev.vars
npm test                 # בדיקות הליבה
npm run preview          # בנייה והרצה בסביבת Cloudflare מקומית
```
הטבלאות נוצרות אוטומטית בהפעלה הראשונה.

## פרסום
המאגר מחובר ל-Worker בשם `hirewise`. כל דחיפה ל-main מפרסמת.
- פקודת בנייה: `npx opennextjs-cloudflare build`
- פקודת פרסום: `npx opennextjs-cloudflare deploy`
- הכתובת `hire.clearwise.me` ומסד הנתונים מוגדרים ב-`wrangler.jsonc`.

## מבנה
| נתיב | תפקיד |
|---|---|
| `src/lib/core/*` | לוגיקה טהורה ונבדקת: מחירים, קרדיטים, שעון המבחן, סימני אמינות, בדיקת אפליה, סכמות הפלט, חתימת Paddle |
| `src/lib/ai.ts` | כתיבת המבחן, תרגום, בדיקת אפליה בהקשר, הערכת מועמד (פלט מובנה ומאומת) |
| `src/lib/jobs.ts` | יצירת משרה, שאלון מנהל, מבחן בסיס ותרגומים שמורים |
| `src/lib/candidate.ts` | חדר המבחן: התחלה, שעון בצד השרת, שמירה אוטומטית, אירועי אמינות, סיום |
| `src/lib/evaluation.ts` | תור ההערכות, פתיחת דו״חות, ניהול קרדיטים אטומי |
| `src/lib/payments.ts` | רכישת חבילות: Grow ישיר / Make / Paddle / הדגמה |
| `src/lib/retention.ts` | מחיקה אוטומטית אחרי `RETENTION_MONTHS`, מחיקת חשבון |
| `src/i18n/*` | שש שפות: en, he, es, fr, de, ar |
| `src/app/a/[slug]` | דף התדריך והסכמה של המועמד, וחדר המבחן |
| `src/app/app/*` | אזור המעסיק: משרות, אשף, דו״חות, קרדיטים, הגדרות |
| `src/app/admin` | מסך ניהול (עברית) |

## הגדרות (סודות ב-Cloudflare, ערכים גלויים ב-`wrangler.jsonc`)
- `ANTHROPIC_API_KEY` — חובה. `AI_MODEL` גלוי.
- `RESEND_API_KEY` — חובה לכניסה (קישור במייל). `MAIL_FROM` גלוי.
- `MAKE_WEBHOOK_URL`, `MAKE_SECRET`, `PAYMENT_HOOK_SECRET` — תשלום בשקלים דרך התרחיש המשותף ב-Make. או `GROW_USER_ID`, `GROW_PAGE_CODE`, `GROW_API_KEY` לחיבור ישיר.
- `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENV` — תשלום בדולר/יורו/ליש״ט. כתובת העדכון: `/api/paddle/webhook`. הדומיין hire.clearwise.me צריך אישור ב-Paddle.
- `ADMIN_KEY` — סיסמת `/admin`. `CRON_SECRET` — סוד המתזמן.
- `DEMO_PAYMENTS`, `DEV_SHOW_LINKS` — לבדיקות מקומיות בלבד. אסור באתר החי.
