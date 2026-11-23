import { requireUser } from "@/lib/auth";
import { userLocale, userT } from "@/lib/view";
import { SettingsForm } from "@/components/forms/settings-form";
import { deleteAccountAction } from "@/app/actions";
import { DICTS } from "@/i18n";

export default async function Settings() {
  const user = await requireUser();
  const t = userT(user);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="h1">{t("settingsTitle")}</h1>
      <SettingsForm
        d={DICTS[userLocale(user)]}
        u={{ name: user.name || "", company: user.company || "", contactEmail: user.contactEmail || "", locale: user.locale, currency: user.preferredCurrency, jurisdiction: user.defaultJurisdiction, email: user.email }}
      />
      <form action={deleteAccountAction} className="card space-y-3 border-red-100">
        <h2 className="h2 text-red-700">{t("deleteAccount")}</h2>
        <p className="text-sm text-ink/60">{t("deleteAccountD")}</p>
        <input name="confirm" className="input max-w-xs" placeholder={t("confirmDeleteAccount")} dir="ltr" />
        <button className="btn-danger">{t("deleteAccount")}</button>
      </form>
    </div>
  );
}
