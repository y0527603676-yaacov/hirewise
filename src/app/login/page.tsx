import { redirect } from "next/navigation";
import { visitorT } from "@/lib/locale";
import { currentUser } from "@/lib/auth";
import { LangLinks, Logo, Notice } from "@/components/ui";
import { LoginForm } from "@/components/forms/login-form";
import { DICTS } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await currentUser()) redirect("/app");
  const { locale, t } = await visitorT();
  const d = DICTS[locale];
  const { e } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo sub={t("byClearwise")} />
      </div>
      <div className="card p-6">
        <h1 className="h1 text-2xl">{t("loginTitle")}</h1>
        <p className="mt-1.5 text-sm text-ink/60">{t("loginSub")}</p>
        {e === "link" && <div className="mt-4"><Notice tone="warn">{t("linkInvalid")}</Notice></div>}
        <div className="mt-6">
          <LoginForm d={{ email: d.email, sendLink: d.sendLink, linkSent: d.linkSent, tooMany: d.tooMany, mailOff: d.mailOff, errEmail: d.errEmail, errGeneric: d.errGeneric, loading: d.loading }} />
        </div>
      </div>
      <div className="mt-6 flex justify-center"><LangLinks current={locale} next="/login" /></div>
    </main>
  );
}
