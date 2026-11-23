import { visitorLocale } from "@/lib/locale";
import { Room } from "@/components/room";
import { Logo } from "@/components/ui";
import { DICTS, dirOf } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function TestRoom({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await visitorLocale();
  return (
    <div dir={dirOf(locale)} lang={locale} className="mx-auto min-h-screen max-w-2xl px-4 py-4">
      <div className="mb-2"><Logo href="#" /></div>
      <Room d={DICTS[locale]} slug={slug} />
    </div>
  );
}
