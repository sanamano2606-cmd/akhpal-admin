"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";
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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-takal-page px-4 py-10">
      {/* A single soft wash of the brand colour behind the card. One shape,
          very pale, well away from any text — the page reads as Takal's
          without anything having to sit on yellow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-takal-yellow opacity-[0.16] blur-3xl"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-takal-yellow shadow-[0_8px_24px_rgba(20,22,25,.14)] ring-1 ring-black/10">
            <span className="text-3xl leading-none">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-takal-ink">Takal</h1>
          <p className="mt-1 text-sm text-takal-ink-soft">Admin panel</p>
        </div>

        <div className="rounded-2xl border border-takal-line bg-white p-7 shadow-[0_1px_2px_rgba(20,22,25,.05),0_12px_32px_rgba(20,22,25,.08)]">
          <h2 className="text-xl font-bold text-takal-ink">Sign in</h2>
          {/* WAS: "Enter your credentials to access the admin panel."
              Nobody outside an office says "credentials", and the rest of this
              panel speaks plainly. */}
          <p className="mt-1 text-sm text-takal-ink-soft">
            Use the email and password for your Takal admin account.
          </p>

          {notice && !error && (
            <div className="mt-5 flex gap-2.5 rounded-lg border border-[#FFD2BF] bg-takal-orange-soft px-4 py-3 text-sm text-[#C8410F]">
              <Clock className="mt-px h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 flex gap-2.5 rounded-lg border border-[#F3C2C7] bg-takal-red-soft px-4 py-3 text-sm text-takal-red"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              {/* htmlFor + id, so tapping the label puts the cursor in the box
                  and a screen reader reads the two together. */}
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-takal-ink"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-takal-ink-soft"
                />
                {/* pl-11 clears the icon. It did not before: globals.css set
                    px-4 on every input with a selector that beat the class —
                    see the note in that file. */}
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-lg border border-takal-line py-2.5 pl-11 pr-4 text-takal-ink outline-none transition focus:border-transparent focus:ring-2 focus:ring-takal-yellow"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-takal-ink"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-takal-ink-soft"
                />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="w-full rounded-lg border border-takal-line py-2.5 pl-11 pr-12 text-takal-ink outline-none transition focus:border-transparent focus:ring-2 focus:ring-takal-yellow"
                />
                {/* A typo in a password you cannot see is the commonest reason
                    a sign-in fails twice. 44px tall, so it can be tapped. */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-takal-ink-soft transition hover:text-takal-ink"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-takal-yellow font-bold text-takal-ink transition hover:bg-takal-yellow-dark disabled:cursor-not-allowed disabled:bg-takal-disabled-bg disabled:text-takal-disabled-text"
            >
              {loading && (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* WAS: "Need help? Contact support" as href="#" — a dead link
              offered to somebody who cannot get in. It now says the true thing:
              there is no support desk, there is Sana. The email comes from
              lib/contact.ts, the one place the business's details are kept. */}
          <p className="mt-6 border-t border-takal-line pt-5 text-center text-xs leading-relaxed text-takal-ink-soft">
            Locked out or need an account?
            <br />
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-takal-ink underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-takal-ink-soft">
          Takal · Swat, Pakistan
        </p>
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
