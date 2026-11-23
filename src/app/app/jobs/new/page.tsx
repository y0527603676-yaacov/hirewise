import { requireUser } from "@/lib/auth";
import { userLocale } from "@/lib/view";
import { JobWizard } from "@/components/forms/job-wizard";
import { LEGAL_BASIS } from "@/lib/core/compliance";
import { DICTS } from "@/i18n";

export default async function NewJob() {
  const user = await requireUser();
  return <JobWizard d={DICTS[userLocale(user)]} defaultJurisdiction={user.defaultJurisdiction} basis={LEGAL_BASIS} locale={userLocale(user)} />;
}
