"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnalyticsIndexRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/analytics/executive"); }, [router]);
  return null;
}
