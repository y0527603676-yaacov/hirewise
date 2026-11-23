"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the page every few seconds while something is being prepared on the server */
export function AutoRefresh({ seconds = 6 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(iv);
  }, [router, seconds]);
  return null;
}
