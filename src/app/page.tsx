"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard or login
    const token = localStorage.getItem("admin_token");
    if (token) {
      router.push("/dashboard");
    } else {
      router.push("/auth/login");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin">
          <div className="w-12 h-12 border-4 border-takal-line border-t-takal-yellow-dark rounded-full"></div>
        </div>
        <p className="mt-4 text-takal-ink-soft">Loading…</p>
      </div>
    </div>
  );
}
