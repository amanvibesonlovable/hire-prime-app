import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import logoUrl from "@/assets/meridian-logo.png";
import { useForceDark } from "@/lib/theme";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Meridian — Sign In" }] }),
});

function LoginPage() {
  useForceDark();
  useDocumentTitle("Meridian — Sign In");
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const onGoogle = async () => {
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) toast.error("Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) { toast.error("Full name is required"); return; }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden" style={{ background: "#0A0A0B" }}>
      {/* Top-left logo */}
      <div className="absolute top-6 left-8 z-20 flex items-center gap-2.5">
        <img src={logoUrl} alt="Meridian" style={{ height: 36, width: "auto" }} />
        <span className="font-mono font-semibold text-[14px] tracking-[0.15em] text-white">MERIDIAN</span>
      </div>

      {/* LEFT PANEL */}
      <div className="hidden md:flex relative w-1/2 overflow-hidden" style={{ background: "#0A0A0B" }}>
        {/* Amber warm glow bottom-left */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: "-15%",
            bottom: "-15%",
            width: "60%",
            height: "60%",
            background: "radial-gradient(circle, rgba(245,158,11,0.05), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Blue radial glow behind brightest dot */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            right: "15%",
            top: "20%",
            width: "300px",
            height: "300px",
            transform: "translate(50%, -50%)",
            background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 65%)",
            filter: "blur(30px)",
          }}
        />

        {/* Orbital arcs SVG */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {/* Main sweeping S-curve arc */}
          <path
            d="M -80 780 C 100 600, 250 350, 680 80"
            fill="none"
            stroke="#3B82F6"
            strokeOpacity="0.32"
            strokeWidth="1"
            style={{
              strokeDasharray: 1500,
              strokeDashoffset: mounted ? 0 : 1500,
              transition: "stroke-dashoffset 2s ease-out",
            }}
          />
          {/* Dotted parallel arc — slightly offset */}
          <path
            d="M -40 820 C 160 660, 320 410, 720 140"
            fill="none"
            stroke="#3B82F6"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray="2 6"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 2s ease-out 0.3s",
            }}
          />
          {/* Third faint arc — deepest layer */}
          <path
            d="M 20 860 C 220 720, 400 470, 760 200"
            fill="none"
            stroke="#3B82F6"
            strokeOpacity="0.08"
            strokeWidth="1"
            strokeDasharray="1 8"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 2s ease-out 0.5s",
            }}
          />
        </svg>

        {/* Glowing dots — positioned along main arc */}
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: "10%",
            top: "72%",
            width: 5,
            height: 5,
            background: "#3B82F6",
            boxShadow: "0 0 10px #3B82F6, 0 0 20px rgba(59,130,246,0.25)",
            opacity: mounted ? 1 : 0,
            transition: "opacity 500ms ease-out 1s",
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: "32%",
            top: "48%",
            width: 5,
            height: 5,
            background: "#3B82F6",
            boxShadow: "0 0 10px #3B82F6, 0 0 20px rgba(59,130,246,0.25)",
            opacity: mounted ? 1 : 0,
            transition: "opacity 500ms ease-out 1.2s",
          }}
        />
        {/* Brightest dot — sun at meridian peak (on arc, upper area) */}
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            right: "12%",
            top: "16%",
            width: 10,
            height: 10,
            background: "#FFFFFF",
            boxShadow:
              "0 0 16px #3B82F6, 0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2)",
            opacity: mounted ? 1 : 0,
            transition: "opacity 500ms ease-out 1.4s",
          }}
        />

        {/* Bottom-left text */}
        <div className="relative z-10 mt-auto" style={{ padding: 48 }}>
          <h2 className="text-white" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.3, textShadow: "0 0 40px rgba(59,130,246,0.15)" }}>
            AI-powered hiring.<br />Built for precision.
          </h2>
          <p className="mt-4 max-w-md" style={{ fontSize: 15, lineHeight: 1.6, color: "#9CA3AF" }}>
            Find, evaluate, and hire the best talent — faster and fairer.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — login card */}
      <div className="flex-1 md:w-1/2 min-h-screen flex items-center justify-center px-4 py-20 md:py-16 relative">
        {/* Mobile-only subtle radial glow */}
        <div
          aria-hidden
          className="md:hidden pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 40%, rgba(59,130,246,0.08), transparent 60%)" }}
        />

        <div
          className="relative w-full"
          style={{
            maxWidth: 440,
            background: "rgba(20, 20, 22, 0.8)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 16,
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 80px -20px rgba(59,130,246,0.12)",
            padding: "clamp(32px, 5vw, 48px)",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 500ms ease-out, transform 500ms ease-out",
          }}
        >
          {/* Logo + brand */}
          <div className="flex flex-col items-center text-center">
            <img src={logoUrl} alt="Meridian" style={{ height: 56, width: "auto" }} />
            <div
              className="mt-3 rounded-full"
              style={{
                width: 4,
                height: 4,
                background: "#3B82F6",
                boxShadow: "0 0 8px #3B82F6, 0 0 16px rgba(59,130,246,0.4)",
              }}
            />
            <div
              className="mt-4 font-mono text-white"
              style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.15em" }}
            >
              MERIDIAN
            </div>
            <p className="mt-2 italic" style={{ fontSize: 14, color: "#71717A" }}>
              Precision hiring. Peak talent.
            </p>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg text-white text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: 44,
                background: "transparent",
                border: "1px solid #1E1E22",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1A1A1E")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <GoogleIcon /> Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="h-px flex-1" style={{ background: "#1E1E22" }} />
            <span className="px-4" style={{ fontSize: 13, color: "#71717A" }}>or</span>
            <div className="h-px flex-1" style={{ background: "#1E1E22" }} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <FieldWithIcon
                id="name"
                label="Full Name"
                icon={<User size={16} color="#4A4A4E" />}
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
                required
              />
            )}
            <FieldWithIcon
              id="email"
              label="Email"
              type="email"
              icon={<Mail size={16} color="#4A4A4E" />}
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              required
            />
            <FieldWithIcon
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              icon={<Lock size={16} color="#4A4A4E" />}
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              required
              minLength={6}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} color="#4A4A4E" /> : <Eye size={16} color="#4A4A4E" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg text-white font-medium transition-[filter] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                height: 48,
                fontSize: 15,
                background: "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)",
                boxShadow: "0 8px 32px -8px rgba(99, 102, 241, 0.6)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center" style={{ fontSize: 14, color: "#71717A" }}>
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium hover:underline"
              style={{ color: "#3B82F6" }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldWithIcon({
  id,
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  minLength,
  rightSlot,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block" style={{ fontSize: 13, color: "#9CA3AF" }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className="w-full rounded-lg text-white outline-none transition-colors"
          style={{
            height: 44,
            background: "#0F0F12",
            border: "1px solid #1E1E22",
            paddingLeft: 38,
            paddingRight: rightSlot ? 38 : 12,
            fontSize: 14,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#1E1E22")}
        />
        {rightSlot}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
