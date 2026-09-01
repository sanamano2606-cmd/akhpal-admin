"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { APIClient } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Fixed at build time. This was an editable field whose value was written to
  // localStorage and then used as the base URL for every authenticated API
  // call — so anyone who could set it (or set the key directly via XSS) could
  // silently redirect the admin's bearer token to their own server.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://swat-delivery-api.onrender.com";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Warm the free-tier server the instant the login page opens (like the
  // customer app does on launch), so it's awake by the time you sign in.
  useEffect(() => {
    try {
      fetch(`${apiUrl}/health`, { cache: "no-store" }).catch(() => {});
    } catch {
      /* ignore */
    }
    // The API client redirects here with ?expired=1 after a 401, so explain WHY
    // the admin was signed out instead of dropping them on a blank form.
    try {
      if (new URLSearchParams(window.location.search).get("expired") === "1") {
        setNotice("Your session expired. Please sign in again.");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Call backend login endpoint
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "admin" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Login failed");
      }

      const data = await response.json();

      // Check if user exists
      if (!data.user) {
        throw new Error("Invalid login response");
      }

      // Belt and braces: start every session with an empty cache.
      //
      // Logout now clears it (see handleLogout in the dashboard layout), but a
      // session can also end without the button being pressed - the tab is
      // closed, the browser crashes, someone just walks away. Clearing here too
      // means one person's customer list can never be the first thing the next
      // person sees.
      APIClient.clearCache();

      // Store token
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.user));

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-takal-page px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-takal-yellow rounded-2xl shadow-lg mb-4">
            <span className="text-3xl text-takal-ink font-bold">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-takal-ink">Takal</h1>
          <p className="text-takal-ink-soft text-sm mt-1">Admin Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-takal-ink mb-2">Sign In</h2>
          <p className="text-takal-ink-soft text-sm mb-6">
            Enter your credentials to access the admin panel
          </p>

          {notice && !error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm">
              ⏱ {notice}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              ✕ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-takal-ink mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-takal-disabled-text" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-takal-ink mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-takal-disabled-text" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 border border-takal-line rounded-lg focus:ring-2 focus:ring-takal-yellow focus:border-transparent outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-takal-yellow hover:bg-takal-yellow-dark disabled:bg-slate-400 text-takal-ink font-semibold py-2 rounded-lg transition mt-6"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-takal-ink-soft text-xs mt-6">
            Need help?{" "}
            <Link href="#" className="text-takal-ink hover:underline font-medium">
              Contact support
            </Link>
          </p>
        </div>

        {/* REMOVED: a "Demo Credentials" box that printed a sample admin email
            and password on this page. It sat on the front of the admin panel,
            needed no login to read, and was in the page source for any scanner
            to find. It told a passing stranger two things for free: that this
            address is an admin panel worth attacking, and exactly what the form
            expects. The live database was checked when it was removed - no such
            account existed, so nothing was actually open. The details are
            deliberately not repeated here. Do not add a hint like this back; if
            you need test details, keep them somewhere that is not published. */}
      </div>
    </div>
  );
}
