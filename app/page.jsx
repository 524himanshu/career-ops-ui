"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FEATURES = [
  {
    icon: "⚡",
    title: "Job Match Evaluator",
    desc: "Paste any JD and your CV. Get a brutal, honest match score with strengths, gaps, and ATS keywords in seconds.",
    color: "#00ff87",
  },
  {
    icon: "📄",
    title: "Tailored Resume Generator",
    desc: "One click rewrites your entire resume to match the job — summary, skills, project bullets, everything. Downloads as DOCX.",
    color: "#00ccff",
  },
  {
    icon: "🎯",
    title: "Interview Prep",
    desc: "Generates the questions they'll actually ask, pulled straight from the JD. Then crafts STAR answers from your real experience.",
    color: "#ff9500",
  },
  {
    icon: "✉️",
    title: "Cold Outreach Writer",
    desc: "One sharp LinkedIn DM or email to the hiring manager. Personalized to the role, not a template they've seen 100 times.",
    color: "#ff4488",
  },
  {
    icon: "💰",
    title: "Salary Estimator",
    desc: "Know your number before the call. Get a realistic range based on the role, company size, and location.",
    color: "#aa88ff",
  },
  {
    icon: "📋",
    title: "Application Tracker",
    desc: "Kanban board for your job search. Track every application from applied to offer, all saved locally.",
    color: "#ffcc00",
  },
  {
    icon: "🔎",
    title: "Job search",
    desc: "job search that filters by your fit score, not just keywords.",
    color: "pink",
  },
];

const STEPS = [
  { n: "01", title: "Paste the JD", desc: "Copy any job description from LinkedIn, Revolut, wherever." },
  { n: "02", title: "Paste your CV", desc: "Plain text is fine. No formatting needed." },
  { n: "03", title: "Add your free Groq key", desc: "Takes 30 seconds at console.groq.com. Free, no credit card." },
  { n: "04", title: "Get everything", desc: "Score, resume, interview prep, outreach message — all generated instantly." },
];

export default function Landing() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = 2847;
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(Math.floor(current));
      if (current >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ background: "#060608", minHeight: "100vh", color: "#fff", fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #00ff8730; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hero-gradient {
          background: linear-gradient(270deg, #00ff87, #00ccff, #aa88ff, #ff4488);
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .feature-card:hover {
          border-color: var(--hover-color) !important;
          transform: translateY(-4px);
        }
        .cta-btn:hover { opacity: 0.9; transform: scale(1.02); }
        .nav-link:hover { color: #fff !important; }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(6,6,8,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid #111" : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#00ff87,#00ccff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>OfferForge</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#features" className="nav-link" style={{ color: "#555", fontSize: 14, textDecoration: "none", transition: "color 0.2s" }}>Features</a>
          <a href="#how" className="nav-link" style={{ color: "#555", fontSize: 14, textDecoration: "none", transition: "color 0.2s" }}>How it works</a>
          <button onClick={() => router.push("/coach")} style={{
            background: "#fff", color: "#000", border: "none", borderRadius: 8,
            padding: "10px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13,
            fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
          }}>
            Launch App →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative" }}>
        {/* Background glow */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #00ff8708 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ animation: "fadeUp 0.6s ease forwards" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: "6px 16px", marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff87", display: "inline-block", animation: "pulse 2s ease infinite" }} />
            <span style={{ fontSize: 12, color: "#666", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>FREE · POWERED BY GROQ + LLAMA 3.3</span>
          </div>

          <h1 style={{ fontSize: "clamp(48px,8vw,88px)", fontWeight: 900, fontFamily: "'Syne',sans-serif", lineHeight: 1.0, letterSpacing: -3, marginBottom: 24 }}>
            Your AI-powered<br />
            <span className="hero-gradient">career coach.</span>
          </h1>

          <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "#555", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7 }}>
            Evaluate job fits, generate tailored resumes, prep for interviews, write cold outreach, and track every application — all free, all in one place.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/coach")} className="cta-btn" style={{
              background: "linear-gradient(135deg,#00ff87,#00ccff)",
              color: "#000", border: "none", borderRadius: 12,
              padding: "16px 36px", fontFamily: "'Syne',sans-serif",
              fontSize: 16, fontWeight: 800, cursor: "pointer",
              transition: "all 0.2s", letterSpacing: -0.3,
            }}>
              Start for free →
            </button>
            <a href="https://github.com/524himanshu/apply-ai" target="_blank" rel="noreferrer" style={{
              background: "transparent", color: "#555", border: "1px solid #222",
              borderRadius: 12, padding: "16px 36px", fontFamily: "'DM Mono',monospace",
              fontSize: 13, cursor: "pointer", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
            }}>
              GitHub ↗
            </a>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 48, marginTop: 80, animation: "fadeUp 0.8s ease 0.2s both", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { value: `${count.toLocaleString()}+`, label: "Resumes generated" },
            { value: "100%", label: "Free to use" },
            { value: "2s", label: "Average response" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono',monospace", marginTop: 4, letterSpacing: 1 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 16 }}>WHAT YOU GET</div>
          <h2 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: -2, lineHeight: 1.1 }}>
            Everything for your<br />job search. Nothing else.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card" style={{
              background: "#0a0a0c", border: "1px solid #141414",
              borderRadius: 16, padding: "28px 28px",
              transition: "all 0.3s", cursor: "default",
              "--hover-color": f.color,
            }}>
              <div style={{ fontSize: 28, marginBottom: 16, animation: "float 3s ease infinite", animationDelay: `${i * 0.2}s`, display: "inline-block" }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Syne',sans-serif", marginBottom: 10, color: "#fff" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div id="how" style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 16 }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: "clamp(32px,5vw,52px)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: -2 }}>
            Four steps.<br />Zero friction.
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 24, position: "relative" }}>
              {/* Line */}
              {i < STEPS.length - 1 && (
                <div style={{ position: "absolute", left: 19, top: 48, bottom: -24, width: 1, background: "#111" }} />
              )}
              <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", background: "#0a0a0c", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "#444" }}>{s.n}</span>
              </div>
              <div style={{ paddingBottom: 40 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div style={{ maxWidth: 900, margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{
          background: "linear-gradient(135deg,#0a1a10,#0a0f1a)",
          border: "1px solid #1a2a1a", borderRadius: 24,
          padding: "64px 48px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,#00ff8710,transparent)", pointerEvents: "none" }} />
          <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: -1.5, marginBottom: 16 }}>
            Ready to land the job?
          </h2>
          <p style={{ color: "#555", fontSize: 16, marginBottom: 36, lineHeight: 1.6 }}>
            Free. No account. No credit card. Just your JD, your CV, and a free Groq key.
          </p>
          <button onClick={() => router.push("/coach")} className="cta-btn" style={{
            background: "linear-gradient(135deg,#00ff87,#00ccff)",
            color: "#000", border: "none", borderRadius: 12,
            padding: "18px 48px", fontFamily: "'Syne',sans-serif",
            fontSize: 18, fontWeight: 800, cursor: "pointer",
            transition: "all 0.2s", letterSpacing: -0.3,
          }}>
            Launch OfferForge →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #0f0f0f", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg,#00ff87,#00ccff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⚡</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15 }}>OfferForge</span>
          <span style={{ fontSize: 12, color: "#333", fontFamily: "'DM Mono',monospace" }}>· Free · Open Source</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#333", fontFamily: "'DM Mono',monospace", textDecoration: "none" }}>Get Groq Key ↗</a>
          <a href="https://github.com/524himanshu/apply-ai" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#333", fontFamily: "'DM Mono',monospace", textDecoration: "none" }}>GitHub ↗</a>
        </div>
      </div>
    </div>
  );
}