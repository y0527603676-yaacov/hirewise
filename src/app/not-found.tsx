import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div>
        <div className="text-5xl font-extrabold text-brand">404</div>
        <Link href="/" className="btn-outline mt-6">Hirewise</Link>
      </div>
    </main>
  );
}
