import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Sparkles,
  Columns,
  BarChart3,
  Search,
  Shield,
  Bell,
  FileUp,
  CheckCircle,
  ArrowRightCircle,
  Check,
  Menu,
  X,
  Play,
  ChevronDown,
} from "lucide-react";
import logoUrl from "@/assets/meridian-logo.png";
import { useForceDark } from "@/lib/theme";

const NAV_LINKS = [
  { id: "features", label: "Features" },
  { id: "workflow", label: "Workflow" },
  { id: "analytics", label: "Analytics" },
  { id: "pricing", label: "Pricing" },
];

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids.join(",")]);
  return active;
}

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number(e.target.getAttribute("data-reveal-index") ?? 0);
            (e.target as HTMLElement).style.transitionDelay = `${idx * 100}ms`;
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return ref;
}

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Meridian"
      width={size}
      height={size}
      className={className}
      style={{ height: size, width: "auto" }}
    />
  );
}

function NavBar() {
  const active = useScrollSpy(NAV_LINKS.map((l) => l.id));
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className="fixed top-0 inset-x-0 z-40 h-16 border-b transition-colors"
        style={{
          background: scrolled ? "rgba(10,10,11,0.85)" : "rgba(10,10,11,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "#1E1E22",
        }}
      >
        <div className="max-w-[1200px] mx-auto h-full px-4 md:px-8 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <LogoMark size={30} />
            <span className="font-mono font-semibold tracking-[0.15em] text-[15px] text-foreground">
              MERIDIAN
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => smoothScrollTo(l.id)}
                className="text-[14px] transition-colors duration-150 cursor-pointer"
                style={{ color: active === l.id ? "#FAFAFA" : "#71717A" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#FAFAFA")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = active === l.id ? "#FAFAFA" : "#71717A")
                }
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-[14px] text-foreground hover:opacity-80">
              Sign in
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center h-8 px-4 rounded-md text-[13px] font-medium text-white shadow-sm hover:brightness-110 transition"
              style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
            >
              Get started
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-foreground p-2 -mr-2"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex flex-col"
          style={{ background: "#0A0A0B" }}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b" style={{ borderColor: "#1E1E22" }}>
            <div className="flex items-center gap-2.5">
              <LogoMark size={30} />
              <span className="font-mono font-semibold tracking-[0.15em] text-[15px]">MERIDIAN</span>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setMobileOpen(false);
                  setTimeout(() => smoothScrollTo(l.id), 50);
                }}
                className="text-2xl font-medium text-foreground"
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="p-6 flex flex-col gap-3 border-t" style={{ borderColor: "#1E1E22" }}>
            <Link
              to="/login"
              className="h-11 rounded-md flex items-center justify-center text-[14px] border"
              style={{ borderColor: "#1E1E22" }}
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="h-11 rounded-md flex items-center justify-center text-[14px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-24 md:pb-32 overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          right: "-10%",
          width: 900,
          height: 900,
          background:
            "radial-gradient(circle, rgba(59,130,246,0.08), rgba(139,92,246,0.05) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #FAFAFA 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-12 md:gap-10 items-center">
        <div>
          <div
            data-reveal
            data-reveal-index="0"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]"
            style={{
              background: "#141416",
              borderColor: "#1E1E22",
              boxShadow: "0 0 24px rgba(139,92,246,0.08)",
            }}
          >
            <span style={{ color: "#8B5CF6" }}>✦</span>
            <span className="text-muted-foreground">AI-powered ATS for fast-scaling hiring teams</span>
          </div>

          <h1
            data-reveal
            data-reveal-index="1"
            className="mt-6 font-semibold text-foreground"
            style={{ fontSize: "clamp(32px, 5.2vw, 56px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Precision hiring for
            <br />
            teams chasing{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              peak talent.
            </span>
          </h1>

          <p
            data-reveal
            data-reveal-index="2"
            className="mt-6 text-[17px]"
            style={{ color: "#9CA3AF", lineHeight: 1.7, maxWidth: 480 }}
          >
            Meridian scores resumes, organizes pipelines, and turns hiring chaos into a clear
            operating system for HR teams hiring 50–200 people a year.
          </p>

          <div data-reveal data-reveal-index="3" className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-[14px] font-medium text-white hover:brightness-110 transition"
              style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
            >
              Start hiring smarter <span aria-hidden>→</span>
            </Link>
            <a
              href="#"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-[14px] font-medium border text-foreground hover:bg-surface transition-colors"
              style={{ borderColor: "#1E1E22" }}
            >
              <Play className="size-3.5" /> Watch product tour
            </a>
          </div>
        </div>

        <div data-reveal data-reveal-index="4" className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 60% 50%, rgba(59,130,246,0.18), rgba(139,92,246,0.10) 40%, transparent 70%)",
              filter: "blur(48px)",
            }}
          />
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const stats = [
    { label: "Open jobs", value: "24" },
    { label: "Candidates", value: "312" },
    { label: "Avg time", value: "23d" },
    { label: "Acceptance", value: "92%" },
  ];
  const columns = [
    { name: "Sourced", count: 3, color: "#3B82F6" },
    { name: "Screening", count: 2, color: "#6366F1" },
    { name: "Interview", count: 3, color: "#8B5CF6" },
    { name: "Offer", count: 2, color: "#EAB308" },
    { name: "Hired", count: 2, color: "#22C55E" },
  ];
  return (
    <div
      className="rounded-xl border overflow-hidden md:transform"
      style={{
        background: "#141416",
        borderColor: "#1E1E22",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)",
        transform: "perspective(1200px) rotateY(-8deg) rotateX(4deg)",
      }}
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b" style={{ borderColor: "#1E1E22" }}>
        <span className="size-2.5 rounded-full" style={{ background: "#EF4444" }} />
        <span className="size-2.5 rounded-full" style={{ background: "#EAB308" }} />
        <span className="size-2.5 rounded-full" style={{ background: "#22C55E" }} />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">Meridian</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg p-2.5 border" style={{ background: "#0F0F12", borderColor: "#1E1E22" }}>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
              <div className="text-[15px] font-semibold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {columns.map((c) => (
            <div key={c.name}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                <span className="text-[10px] text-muted-foreground truncate">{c.name}</span>
              </div>
              <div className="space-y-1.5">
                {Array.from({ length: c.count }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-md p-1.5 border"
                    style={{ background: "#0F0F12", borderColor: "#1E1E22" }}
                  >
                    <div className="flex items-center gap-1">
                      <div className="size-3 rounded-full" style={{ background: "#2A2A2E" }} />
                      <div className="h-1 flex-1 rounded" style={{ background: "#2A2A2E" }} />
                    </div>
                    <div className="mt-1 flex justify-end">
                      <span
                        className="text-[8px] px-1 rounded"
                        style={{ background: c.color + "22", color: c.color }}
                      >
                        {7 + i}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="h-px max-w-[1200px] mx-auto"
      style={{ background: "linear-gradient(90deg, transparent, #3B82F6, transparent)", opacity: 0.4 }}
    />
  );
}

function Features() {
  const features = [
    { icon: Sparkles, color: "#8B5CF6", title: "AI resume scoring", desc: "Instantly rank candidates with AI that learns what great looks like for your roles. Scores 1–10 with detailed strengths, concerns, and hire recommendations." },
    { icon: Columns, color: "#3B82F6", title: "Visual hiring pipeline", desc: "See every stage at a glance with drag-and-drop Kanban boards. Custom pipelines per role keep your process flexible." },
    { icon: BarChart3, color: "#3B82F6", title: "Hiring analytics", desc: "Track time-to-hire, pipeline funnels, bottleneck stages, and recruiter activity. Make data-backed hiring decisions faster." },
    { icon: Search, color: "#3B82F6", title: "Global search", desc: "Find any candidate or job instantly with Cmd+K search. Your entire hiring database, one keystroke away." },
    { icon: Shield, color: "#3B82F6", title: "Secure by design", desc: "Row-level security on every table. Your API keys are encrypted per user. Candidate data stays protected." },
    { icon: Bell, color: "#3B82F6", title: "Team notifications", desc: "Stay aligned with real-time updates when candidates apply, get scored, reach offer stage, or get hired." },
  ];
  return (
    <section id="features" className="py-20 md:py-32" style={{ background: "#0F0F12" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 data-reveal data-reveal-index="0" className="text-[28px] md:text-[32px] font-semibold tracking-tight">
            Everything your hiring desk needs. Nothing it doesn't.
          </h2>
          <p data-reveal data-reveal-index="1" className="mt-4 text-[16px]" style={{ color: "#9CA3AF" }}>
            Built for speed, focus, and consistency — so your team can focus on people, not paperwork.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              data-reveal-index={i}
              className="group rounded-xl border p-7 transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "#141416", borderColor: "#1E1E22" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2A2A2E")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1E1E22")}
            >
              <div
                className="size-10 rounded-lg flex items-center justify-center"
                style={{ background: "#1E1E22" }}
              >
                <f.icon className="size-5" style={{ color: f.color }} />
              </div>
              <h3 className="mt-4 text-[16px] font-medium text-foreground">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#9CA3AF" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    { n: "01", icon: FileUp, color: "#71717A", title: "Resume received", desc: "Candidate applies via your job link." },
    { n: "02", icon: Sparkles, color: "#8B5CF6", title: "AI fit score generated", desc: "Meridian analyzes resume and role fit." },
    { n: "03", icon: CheckCircle, color: "#71717A", title: "Strengths identified", desc: "Key skills and experience are highlighted." },
    { n: "04", icon: ArrowRightCircle, color: "#71717A", title: "Candidate moved", desc: "Automatically placed in the right pipeline stage." },
  ];
  return (
    <section id="workflow" className="py-20 md:py-32">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 grid md:grid-cols-[2fr_3fr] gap-12 items-center">
        <div>
          <h2 data-reveal data-reveal-index="0" className="text-[28px] md:text-[32px] font-semibold tracking-tight">
            Turn every resume into a decision-ready profile.
          </h2>
          <p data-reveal data-reveal-index="1" className="mt-4 text-[16px]" style={{ color: "#9CA3AF", lineHeight: 1.7 }}>
            Meridian's AI handles the busywork — so your team can focus on conversations that close.
          </p>
          <a
            data-reveal
            data-reveal-index="2"
            href="#"
            className="mt-6 inline-flex items-center gap-1.5 text-[14px]"
            style={{ color: "#3B82F6" }}
          >
            See workflow in action <span aria-hidden>→</span>
          </a>
        </div>

        <div data-reveal data-reveal-index="3" className="relative">
          {/* Desktop horizontal */}
          <div className="hidden md:grid grid-cols-4 gap-4 relative">
            <div className="absolute top-7 left-[12.5%] right-[12.5%] h-px" style={{ background: "#1E1E22" }} />
            {steps.map((s) => (
              <div key={s.n} className="flex flex-col items-center text-center relative">
                <div
                  className="size-14 rounded-full flex items-center justify-center bg-background border-2 font-mono text-[13px] font-semibold"
                  style={{ borderColor: "#3B82F6", color: "#3B82F6" }}
                >
                  {s.n}
                </div>
                <s.icon className="mt-3 size-5" style={{ color: s.color }} />
                <div className="mt-2 text-[14px] font-medium">{s.title}</div>
                <div className="mt-1 text-[13px]" style={{ color: "#71717A", maxWidth: 140 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
          {/* Mobile vertical */}
          <div className="md:hidden relative pl-16">
            <div className="absolute top-3 bottom-3 left-7 w-px" style={{ background: "#1E1E22" }} />
            <div className="space-y-8">
              {steps.map((s) => (
                <div key={s.n} className="relative">
                  <div
                    className="absolute -left-16 size-14 rounded-full flex items-center justify-center bg-background border-2 font-mono text-[13px] font-semibold"
                    style={{ borderColor: "#3B82F6", color: "#3B82F6" }}
                  >
                    {s.n}
                  </div>
                  <div className="flex items-center gap-2">
                    <s.icon className="size-4" style={{ color: s.color }} />
                    <div className="text-[14px] font-medium">{s.title}</div>
                  </div>
                  <div className="mt-1 text-[13px]" style={{ color: "#71717A" }}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsPreview() {
  const bars = [
    { label: "Sourced", count: 1248, pct: 100, gradient: "linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)" },
    { label: "Screening", count: 842, pct: 67, gradient: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)" },
    { label: "Interview", count: 395, pct: 32, gradient: "linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)" },
    { label: "Offer", count: 112, pct: 9, gradient: "linear-gradient(180deg, #F59E0B 0%, #D97706 100%)" },
    { label: "Hired", count: 78, pct: 6, gradient: "linear-gradient(180deg, #22C55E 0%, #16A34A 100%)" },
  ];

  const sectionRef = useRef<HTMLElement | null>(null);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setAnimate(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const yLabels = ["1,250", "1,000", "750", "500", "250", "0"];
  const chartHeight = 240;

  return (
    <section ref={sectionRef} id="analytics" className="py-20 md:py-32" style={{ background: "#0F0F12" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 grid md:grid-cols-[1fr_2fr] gap-12 items-center">
        <div>
          <h2 data-reveal data-reveal-index="0" className="text-[28px] md:text-[32px] font-semibold tracking-tight">
            See bottlenecks before they become missed hires.
          </h2>
          <p data-reveal data-reveal-index="1" className="mt-4 text-[16px]" style={{ color: "#9CA3AF" }}>
            Real-time analytics help you find friction, improve flow, and close roles faster.
          </p>
          <a
            data-reveal
            data-reveal-index="2"
            href="#"
            className="mt-6 inline-flex items-center gap-1.5 text-[14px]"
            style={{ color: "#3B82F6" }}
          >
            Explore analytics <span aria-hidden>→</span>
          </a>
        </div>

        <div data-reveal data-reveal-index="3" className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(59,130,246,0.22), rgba(139,92,246,0.14) 40%, transparent 70%)",
              filter: "blur(48px)",
            }}
          />
          <div
            className="rounded-xl border"
            style={{
              background: "#141416",
              borderColor: "#1E1E22",
              padding: 32,
              boxShadow: "0 0 60px -20px rgba(59,130,246,0.15) inset",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-[14px] font-medium text-white">Pipeline overview</div>
              <div
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-white"
                style={{ background: "#1E1E22", border: "1px solid #2A2A2E" }}
              >
                This month
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Secondary stat row */}
            <div
              className="mt-4 flex items-center justify-between"
              style={{ padding: "12px 0", borderBottom: "1px solid #1E1E22" }}
            >
              {[
                { label: "Total candidates", value: "1,248" },
                { label: "Conversion rate", value: "6.2%" },
                { label: "Avg. time to hire", value: "23 days" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="flex-1 flex items-center justify-center gap-2 text-[12px]"
                  style={{
                    borderLeft: i === 0 ? "none" : "1px solid #1E1E22",
                  }}
                >
                  <span style={{ color: "#71717A" }}>{s.label}:</span>
                  <span className="text-white font-medium">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="mt-8 flex gap-4">
              {/* Y-axis */}
              <div
                className="flex flex-col justify-between text-[11px] font-mono text-right"
                style={{ color: "#71717A", height: chartHeight, minWidth: 40 }}
              >
                {yLabels.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>

              {/* Chart area */}
              <div className="flex-1 relative" style={{ height: chartHeight, borderLeft: "1px solid #1E1E22" }}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((p) => (
                  <div
                    key={p}
                    className="absolute left-0 right-0"
                    style={{
                      bottom: `${p}%`,
                      borderTop: "1px dashed #1E1E22",
                      height: 0,
                    }}
                  />
                ))}

                {/* Bars */}
                <div className="absolute inset-0 grid grid-cols-5 gap-2 items-end px-2">
                  {bars.map((b, i) => (
                    <div key={b.label} className="relative flex flex-col items-center justify-end h-full">
                      {/* Number above bar */}
                      <div
                        className="absolute text-[14px] font-medium text-white"
                        style={{
                          bottom: animate ? `calc(${b.pct}% + 8px)` : "8px",
                          transition: `bottom 800ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 100}ms`,
                        }}
                      >
                        {b.count.toLocaleString()}
                      </div>
                      {/* Bar */}
                      <div
                        className="w-full"
                        style={{
                          height: animate ? `${b.pct}%` : "0%",
                          background: b.gradient,
                          borderRadius: "4px 4px 0 0",
                          transition: `height 800ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 100}ms`,
                          boxShadow: "0 -8px 24px -8px rgba(59,130,246,0.25)",
                          minHeight: animate ? 6 : 0,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar labels */}
            <div className="mt-3 grid grid-cols-5 gap-2 px-2" style={{ paddingLeft: 56 }}>
              {bars.map((b) => (
                <div key={b.label} className="text-center">
                  <div className="text-[12px] font-medium text-white">{b.label}</div>
                  <div className="text-[11px]" style={{ color: "#71717A" }}>{b.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  desc,
  price,
  unit,
  note,
  features,
  cta,
  featured,
}: {
  name: string;
  desc: string;
  price: string;
  unit?: string;
  note?: string;
  features: string[];
  cta: string;
  featured?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-8 relative"
      style={{
        background: "#141416",
        border: featured ? "2px solid #3B82F6" : "1px solid #1E1E22",
      }}
    >
      {featured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[12px] font-medium text-white whitespace-nowrap"
          style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
        >
          Most popular
        </div>
      )}
      <div className="text-[20px] font-semibold">{name}</div>
      <div className="mt-1 text-[14px]" style={{ color: "#9CA3AF" }}>{desc}</div>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-[36px] font-semibold">{price}</span>
        {unit && <span className="text-[14px]" style={{ color: "#71717A" }}>{unit}</span>}
      </div>
      {note && <div className="mt-1 text-[12px]" style={{ color: "#71717A" }}>{note}</div>}
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[14px]">
            <Check className="size-4 mt-0.5 shrink-0" style={{ color: "#3B82F6" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        className="mt-8 w-full h-11 rounded-lg text-[14px] font-medium transition"
        style={
          featured
            ? { background: "linear-gradient(135deg, #3B82F6, #6366F1)", color: "white" }
            : { background: "transparent", color: "white", border: "1px solid #1E1E22" }
        }
      >
        {cta}
      </button>
    </div>
  );
}

function Pricing() {
  const [email, setEmail] = useState("");
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thanks! We'll be in touch.");
    setEmail("");
  };
  return (
    <section id="pricing" className="py-20 md:py-32 relative">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 data-reveal data-reveal-index="0" className="text-[28px] md:text-[32px] font-semibold tracking-tight">
            Premium hiring software without enterprise bloat.
          </h2>
          <p data-reveal data-reveal-index="1" className="mt-4 text-[16px]" style={{ color: "#9CA3AF" }}>
            Simple, transparent pricing that grows with your team.
          </p>
        </div>

        <div className="relative mt-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PricingCard
              name="Launch"
              desc="Everything you need to get started."
              price="$49"
              unit="/user/month"
              note="Billed annually"
              features={["Up to 5 open jobs", "AI resume scoring", "Visual pipeline", "Email support"]}
              cta="Start free trial"
            />
            <PricingCard
              name="Scale"
              desc="For growing teams that move fast."
              price="$99"
              unit="/user/month"
              features={["Unlimited open jobs", "Advanced analytics", "Workflow automations", "Priority support"]}
              cta="Start free trial"
              featured
            />
            <PricingCard
              name="Enterprise"
              desc="For organizations that need more."
              price="Custom"
              note="Let's build the right plan for you."
              features={["SSO & advanced security", "Custom integrations", "Dedicated success manager", "Custom reporting"]}
              cta="Book a demo"
            />
          </div>

          {/* Coming soon overlay */}
          <div
            className="absolute inset-0 rounded-xl flex flex-col items-center justify-center p-6 text-center"
            style={{
              background: "rgba(10,10,11,0.7)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <span
              className="px-5 py-1.5 rounded-full text-[14px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
            >
              Coming soon
            </span>
            <p className="mt-4 text-[16px] text-foreground max-w-md">
              Pricing plans are coming soon. Join the waitlist to be the first to know.
            </p>
            <form onSubmit={onSubmit} className="mt-5 flex flex-col sm:flex-row gap-2 w-full max-w-[600px] justify-center">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="h-11 rounded-lg px-4 text-[14px] border outline-none focus:border-primary sm:w-[280px]"
                style={{ background: "#141416", borderColor: "#1E1E22", color: "white" }}
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-lg text-[14px] font-medium text-white"
                style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
              >
                Join waitlist →
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterCTA() {
  return (
    <section className="py-20 md:py-28" style={{ background: "#0F0F12" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col md:flex-row gap-8 items-center justify-between text-center md:text-left">
        <div className="flex items-center gap-5">
          <LogoMark size={64} />
          <h3
            className="text-[24px] md:text-[28px] font-semibold tracking-tight"
            style={{ lineHeight: 1.25, maxWidth: 480 }}
          >
            Reach the highest point of your{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              hiring process.
            </span>
          </h3>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 h-12 px-8 rounded-lg text-[14px] font-medium text-white whitespace-nowrap hover:brightness-110 transition"
          style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)" }}
        >
          Build your hiring command center →
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-10" style={{ background: "#0A0A0B", borderColor: "#1E1E22" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col md:flex-row gap-4 items-center justify-between text-center">
        <div className="flex items-center gap-3 text-[13px]" style={{ color: "#71717A" }}>
          <LogoMark size={20} />
          <span className="font-mono font-semibold tracking-[0.15em] text-foreground">MERIDIAN</span>
          <span>© 2026 Meridian. All rights reserved.</span>
        </div>
        <div className="flex gap-6 text-[13px]" style={{ color: "#71717A" }}>
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  useForceDark();
  const ref = useReveal();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="min-h-screen bg-background text-foreground" style={{ scrollBehavior: "smooth" }}>
      <style>{`
        [data-reveal] {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 500ms ease-out, transform 500ms ease-out;
          will-change: opacity, transform;
        }
        [data-reveal].reveal-in {
          opacity: 1;
          transform: translateY(0);
        }
        html { scroll-behavior: smooth; }
      `}</style>
      <NavBar />
      <main>
        <Hero />
        <Divider />
        <Features />
        <Workflow />
        <AnalyticsPreview />
        <Pricing />
        <FooterCTA />
      </main>
      <Footer />
    </div>
  );
}
