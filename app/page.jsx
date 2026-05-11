"use client";
import { useState } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat, UnderlineType, TabStopType, ExternalHyperlink } from "docx";
import { saveAs } from "file-saver";

// ─── PROMPTS ────────────────────────────────────────────────────────────────

const EVAL_PROMPT = `You are a senior technical recruiter and career coach. Analyze the job description and CV provided, then return ONLY a valid JSON object with this exact structure:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "role": "<job title extracted from JD>",
  "company": "<company name extracted from JD>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "summary": "<2-3 sentence honest assessment of fit>",
  "recommendation": "<apply/maybe/skip>"
}
Return only the JSON. No markdown, no explanation, no preamble.`;

const RESUME_PROMPT = `You are an expert resume writer. Given a job description and a candidate's CV, generate a fully tailored resume as a JSON object.

Return ONLY valid JSON with this exact structure:
{
  "name": "<candidate full name>",
  "title": "<job title from JD>",
  "contact": "<email | phone | linkedin | github | portfolio — extract from CV>",
  "summary": "<3 sentences tailored to this JD, first person, specific, no buzzwords>",
  "skills": {
    "Frontend": "<comma separated relevant skills>",
    "Backend": "<comma separated relevant skills>",
    "AI/ML": "<comma separated relevant skills — only if relevant to JD>",
    "Tools": "<comma separated relevant tools>"
  },
  "projects": [
    {
      "name": "<project name>",
      "stack": "<tech stack>",
      "bullets": ["<rewritten bullet 1 tailored to JD>", "<rewritten bullet 2>", "<rewritten bullet 3>"]
    }
  ],
  "experience": [
    {
      "role": "<job title>",
      "company": "<company>",
      "period": "<dates>",
      "bullets": ["<bullet 1>", "<bullet 2>"]
    }
  ],
  "education": [
    {
      "degree": "<degree>",
      "institution": "<institution>",
      "period": "<dates>",
      "note": "<GPA or achievement if relevant>"
    }
  ],
  "certifications": ["<cert 1>", "<cert 2>", "<cert 3>"],
  "cover_note": "<one strong paragraph cover note for this specific role, direct and confident, no corporate speak>"
}

Rules:
- Rewrite project bullets to emphasize what's most relevant to the JD
- Only include skills relevant to the JD
- Keep projects to the 3 most relevant ones
- Be honest — don't invent experience that isn't in the CV
- Return only the JSON, no markdown, no preamble`;

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const SCORE_COLORS = {
  A: { bg: "#0a2a1a", border: "#00ff87", text: "#00ff87" },
  B: { bg: "#1a2a0a", border: "#7fff00", text: "#7fff00" },
  C: { bg: "#2a1a00", border: "#ffaa00", text: "#ffaa00" },
  D: { bg: "#2a0a0a", border: "#ff4444", text: "#ff4444" },
  F: { bg: "#1a0000", border: "#ff0000", text: "#ff0000" },
};

const REC_LABELS = { apply: "Strong Apply", maybe: "Apply with Caution", skip: "Skip This One" };
const REC_COLORS = { apply: "#00ff87", maybe: "#ffaa00", skip: "#ff4444" };

// ─── GROQ CALL ──────────────────────────────────────────────────────────────

async function callGroq(apiKey, systemPrompt, userContent) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Groq API error");
  }
  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ─── DOCX GENERATOR ─────────────────────────────────────────────────────────

async function generateDocx(resume) {
  const FONT = "Calibri";
  const C = { dark: "1A1A1A", mid: "444444", light: "666666", accent: "1a56db", rule: "CCCCCC" };

  const sectionHeader = (text) => new Paragraph({
    spacing: { before: 200, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1a56db", space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: FONT, color: C.dark, characterSpacing: 40 })],
  });

  const bul = (text) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text, size: 20, font: FONT, color: C.mid })],
  });

  const skillRow = (label, value) => new Paragraph({
    spacing: { before: 30, after: 30 },
    children: [
      new TextRun({ text: label + ":  ", bold: true, size: 20, font: FONT, color: C.dark }),
      new TextRun({ text: value, size: 20, font: FONT, color: C.mid }),
    ],
  });

  const twoCol = (left, right) => new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
    spacing: { before: 30, after: 30 },
    children: [
      new TextRun({ text: left, bold: true, size: 20, font: FONT, color: C.dark }),
      new TextRun({ text: "\t" + right, size: 19, font: FONT, color: C.light, italics: true }),
    ],
  });

  const projectBullets = (p) => [
    new Paragraph({
      spacing: { before: 140, after: 40 },
      children: [
        new TextRun({ text: p.name, bold: true, size: 21, font: FONT, color: C.dark }),
        new TextRun({ text: "  |  ", size: 20, font: FONT, color: C.light }),
        new TextRun({ text: p.stack, size: 19, font: FONT, color: C.light, italics: true }),
      ],
    }),
    ...p.bullets.map(bul),
  ];

  const children = [
    // Name
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [new TextRun({ text: resume.name.toUpperCase(), bold: true, size: 52, font: FONT, color: C.dark })],
    }),
    // Title
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: resume.title, size: 24, font: FONT, color: "1a56db", bold: true })],
    }),
    // Contact
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: resume.contact, size: 19, font: FONT, color: C.light })],
    }),
    // Summary
    sectionHeader("Summary"),
    new Paragraph({
      spacing: { before: 80, after: 120 },
      children: [new TextRun({ text: resume.summary, size: 20, font: FONT, color: C.mid })],
    }),
    // Skills
    sectionHeader("Technical Skills"),
    new Paragraph({ spacing: { before: 80, after: 0 }, children: [] }),
    ...Object.entries(resume.skills)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => skillRow(k, v)),
    new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }),
    // Projects
    sectionHeader("Projects"),
    ...resume.projects.flatMap(projectBullets),
    // Experience
    sectionHeader("Experience"),
    ...resume.experience.flatMap(e => [
      twoCol(`${e.role} · ${e.company}`, e.period),
      ...e.bullets.map(bul),
    ]),
    // Education
    sectionHeader("Education"),
    ...resume.education.flatMap(e => [
      twoCol(e.degree + " · " + e.institution, e.period),
      ...(e.note ? [new Paragraph({
        spacing: { before: 20, after: 60 },
        children: [new TextRun({ text: e.note, size: 19, font: FONT, color: C.light })],
      })] : []),
    ]),
    // Certs
    sectionHeader("Certifications"),
    ...resume.certifications.map(bul),
  ];

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 480, hanging: 240 } },
            run: { size: 20, font: FONT, color: C.mid },
          },
        }],
      }],
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 900, left: 1080 } },
      },
      children,
    }],
  });

  const buf = await Packer.toBlob(doc);
  saveAs(buf, `${resume.name.replace(/\s+/g, "_")}_Tailored_Resume.docx`);
}

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────

function ScoreRing({ score, grade }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const colors = SCORE_COLORS[grade] || SCORE_COLORS.C;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="8" />
        <circle cx="65" cy="65" r={radius} fill="none" stroke={colors.border} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: colors.text, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>SCORE</span>
      </div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20,
      background: "#1a1a1a", border: "1px solid #2a2a2a",
      color: "#888", fontSize: 11, fontFamily: "'DM Mono',monospace",
    }}>{children}</span>
  );
}

function ResumePreview({ resume, onDownload, downloading }) {
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
      {/* Preview header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3 }}>TAILORED RESUME PREVIEW</div>
        <button onClick={onDownload} disabled={downloading} style={{
          background: downloading ? "#1a1a1a" : "#1a56db",
          color: downloading ? "#555" : "#fff",
          border: "none", borderRadius: 8, padding: "10px 20px",
          fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600,
          cursor: downloading ? "not-allowed" : "pointer", transition: "all 0.2s",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {downloading ? "Generating..." : "↓ Download DOCX"}
        </button>
      </div>

      {/* Resume content */}
      <div style={{ padding: "32px 40px", fontFamily: "'DM Sans',sans-serif" }}>
        {/* Name + title */}
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "2px solid #1e1e1e" }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 4px", fontFamily: "'Syne',sans-serif", letterSpacing: -0.5 }}>
            {resume.name}
          </h1>
          <div style={{ fontSize: 15, color: "#4488ff", fontWeight: 600, marginBottom: 8 }}>{resume.title}</div>
          <div style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono',monospace" }}>{resume.contact}</div>
        </div>

        {/* Summary */}
        <Section title="Summary">
          <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{resume.summary}</p>
        </Section>

        {/* Skills */}
        <Section title="Technical Skills">
          {Object.entries(resume.skills).filter(([, v]) => v?.trim()).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, minWidth: 90, flexShrink: 0 }}>{k}:</span>
              <span style={{ color: "#888", fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </Section>

        {/* Projects */}
        <Section title="Projects">
          {resume.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                <span style={{ color: "#444", fontSize: 12 }}>|</span>
                <span style={{ color: "#555", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{p.stack}</span>
              </div>
              {p.bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                  <span style={{ color: "#333", flexShrink: 0 }}>–</span>
                  <span style={{ color: "#999", fontSize: 13, lineHeight: 1.6 }}>{b}</span>
                </div>
              ))}
            </div>
          ))}
        </Section>

        {/* Experience */}
        <Section title="Experience">
          {resume.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{e.role} · {e.company}</span>
                <span style={{ color: "#555", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{e.period}</span>
              </div>
              {e.bullets.map((b, j) => (
                <div key={j} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                  <span style={{ color: "#333", flexShrink: 0 }}>–</span>
                  <span style={{ color: "#999", fontSize: 13, lineHeight: 1.6 }}>{b}</span>
                </div>
              ))}
            </div>
          ))}
        </Section>

        {/* Education */}
        <Section title="Education">
          {resume.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{e.degree} · {e.institution}</span>
                <span style={{ color: "#555", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{e.period}</span>
              </div>
              {e.note && <div style={{ color: "#555", fontSize: 12, marginTop: 3 }}>{e.note}</div>}
            </div>
          ))}
        </Section>

        {/* Certifications */}
        <Section title="Certifications">
          {resume.certifications.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
              <span style={{ color: "#333", flexShrink: 0 }}>–</span>
              <span style={{ color: "#999", fontSize: 13 }}>{c}</span>
            </div>
          ))}
        </Section>

        {/* Cover note */}
        {resume.cover_note && (
          <Section title="Cover Note">
            <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{resume.cover_note}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10, color: "#4488ff", fontFamily: "'DM Mono',monospace",
        letterSpacing: 3, marginBottom: 12, paddingBottom: 6,
        borderBottom: "1px solid #1a1a1a",
      }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function EvalCard({ eval: ev, onReset, onGenerateResume, generatingResume }) {
  const colors = SCORE_COLORS[ev.grade] || SCORE_COLORS.C;
  const recColor = REC_COLORS[ev.recommendation] || "#888";

  return (
    <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 6 }}>EVALUATION COMPLETE</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0, fontFamily: "'Syne',sans-serif" }}>{ev.role}</h2>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>{ev.company}</div>
        </div>
        <button onClick={onReset} style={{
          background: "transparent", border: "1px solid #2a2a2a", color: "#555",
          padding: "8px 16px", borderRadius: 6, cursor: "pointer",
          fontFamily: "'DM Mono',monospace", fontSize: 12,
        }}>← New</button>
      </div>

      {/* Score + Rec */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto", background: colors.bg, border: `1px solid ${colors.border}22`, borderRadius: 12, padding: "24px 32px", display: "flex", alignItems: "center", gap: 20 }}>
          <ScoreRing score={ev.score} grade={ev.grade} />
          <div>
            <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 8 }}>GRADE</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: colors.text, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{ev.grade}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: `${recColor}10`, border: `1px solid ${recColor}33`, borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 8 }}>RECOMMENDATION</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: recColor, fontFamily: "'Syne',sans-serif" }}>{REC_LABELS[ev.recommendation]}</div>
        </div>
      </div>

      {/* Assessment */}
      <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 12 }}>ASSESSMENT</div>
        <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{ev.summary}</p>
      </div>

      {/* Strengths + Gaps */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#001a0d", border: "1px solid #00ff8722", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#00ff87", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 16 }}>STRENGTHS</div>
          {ev.strengths.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span style={{ color: "#00ff87", flexShrink: 0 }}>✓</span>
              <span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#1a0000", border: "1px solid #ff444422", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#ff4444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 16 }}>GAPS</div>
          {ev.gaps.map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span style={{ color: "#ff4444", flexShrink: 0 }}>✗</span>
              <span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.5 }}>{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 14 }}>ATS KEYWORDS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ev.keywords.map((k, i) => <Chip key={i}>{k}</Chip>)}
        </div>
      </div>

      {/* Generate Resume CTA */}
      <button onClick={onGenerateResume} disabled={generatingResume} style={{
        width: "100%", padding: "18px", borderRadius: 12,
        background: generatingResume ? "#1a1a1a" : "linear-gradient(135deg, #00ff87, #00ccff)",
        border: "none", cursor: generatingResume ? "not-allowed" : "pointer",
        fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800,
        color: generatingResume ? "#555" : "#000",
        transition: "all 0.2s", letterSpacing: -0.3,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        {generatingResume ? (
          <>
            <div style={{ width: 16, height: 16, border: "2px solid #333", borderTopColor: "#888", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Generating Tailored Resume...
          </>
        ) : "⚡ Generate Tailored Resume + DOCX"}
      </button>
    </div>
  );
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

export default function CareerOps() {
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [resumeResult, setResumeResult] = useState(null);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const evaluate = async () => {
    if (!jd.trim() || !cv.trim() || !apiKey.trim()) { setError("All fields required."); return; }
    setLoading(true); setError("");
    try {
      const result = await callGroq(apiKey, EVAL_PROMPT, `JOB DESCRIPTION:\n${jd}\n\n---\n\nMY CV:\n${cv}`);
      setEvalResult(result);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const generateResume = async () => {
    setGeneratingResume(true); setError("");
    try {
      const result = await callGroq(apiKey, RESUME_PROMPT, `JOB DESCRIPTION:\n${jd}\n\n---\n\nMY CV:\n${cv}`);
      setResumeResult(result);
    } catch (e) {
      setError(e.message || "Resume generation failed.");
    } finally {
      setGeneratingResume(false);
    }
  };

  const downloadDocx = async () => {
    if (!resumeResult) return;
    setDownloading(true);
    try { await generateDocx(resumeResult); }
    catch (e) { setError("DOCX generation failed: " + e.message); }
    finally { setDownloading(false); }
  };

  const reset = () => {
    setEvalResult(null); setResumeResult(null);
    setJd(""); setCv(""); setStep(1); setError("");
  };

  const steps = [{ n: 1, label: "Job Description" }, { n: 2, label: "Your CV" }, { n: 3, label: "API Key" }];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        textarea, input { outline: none !important; }
        textarea { resize: vertical; }
        ::selection { background: #00ff8730; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48, animation: "fadeUp 0.4s ease forwards" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00ff87,#00ccff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#555", letterSpacing: 2 }}>CAREER-OPS</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#00ff87", background: "#00ff8715", border: "1px solid #00ff8730", borderRadius: 4, padding: "2px 8px", letterSpacing: 1 }}>FREE</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px,5vw,48px)", fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#fff", margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
            AI Job Evaluator
          </h1>
          <p style={{ color: "#555", fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
            Paste a JD. Paste your CV. Get a match score + a fully tailored resume — free, via Groq.
          </p>
        </div>

        {/* Main content */}
        {!evalResult ? (
          <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
            {/* Steps */}
            <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
              {steps.map(s => (
                <button key={s.n} onClick={() => setStep(s.n)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: step === s.n ? "#1a1a1a" : "transparent",
                  border: `1px solid ${step === s.n ? "#2a2a2a" : "transparent"}`,
                  borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: step >= s.n ? "#00ff87" : "#1a1a1a",
                    border: `1px solid ${step >= s.n ? "#00ff87" : "#2a2a2a"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: step >= s.n ? "#000" : "#555",
                    fontFamily: "'DM Mono',monospace", flexShrink: 0, transition: "all 0.3s",
                  }}>
                    {step > s.n ? "✓" : s.n}
                  </div>
                  <span style={{ fontSize: 12, color: step === s.n ? "#fff" : "#444", fontFamily: "'DM Mono',monospace" }}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Step 1 */}
            {step === 1 && (
              <div style={{ animation: "fadeUp 0.3s ease forwards" }}>
                <label style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 12 }}>JOB DESCRIPTION</label>
                <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here..." rows={12}
                  style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, color: "#ccc", fontSize: 14, padding: "16px 18px", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }} />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={() => jd.trim() && setStep(2)} disabled={!jd.trim()}
                    style={{ background: jd.trim() ? "#00ff87" : "#1a1a1a", color: jd.trim() ? "#000" : "#333", border: "none", borderRadius: 8, padding: "12px 28px", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, cursor: jd.trim() ? "pointer" : "not-allowed" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div style={{ animation: "fadeUp 0.3s ease forwards" }}>
                <label style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 12 }}>YOUR CV / RESUME</label>
                <textarea value={cv} onChange={e => setCv(e.target.value)} placeholder="Paste your CV as plain text here..." rows={12}
                  style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, color: "#ccc", fontSize: 14, padding: "16px 18px", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                  <button onClick={() => setStep(1)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", borderRadius: 8, padding: "12px 24px", fontFamily: "'DM Mono',monospace", fontSize: 13, cursor: "pointer" }}>← Back</button>
                  <button onClick={() => cv.trim() && setStep(3)} disabled={!cv.trim()}
                    style={{ background: cv.trim() ? "#00ff87" : "#1a1a1a", color: cv.trim() ? "#000" : "#333", border: "none", borderRadius: 8, padding: "12px 28px", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, cursor: cv.trim() ? "pointer" : "not-allowed" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div style={{ animation: "fadeUp 0.3s ease forwards" }}>
                <label style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 12 }}>GROQ API KEY</label>
                <div style={{ position: "relative" }}>
                  <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="gsk_..."
                    style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, color: "#ccc", fontSize: 14, padding: "14px 48px 14px 18px", fontFamily: "'DM Mono',monospace" }} />
                  <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: 14 }}>
                    {showKey ? "🙈" : "👁"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "#444", marginTop: 10, fontFamily: "'DM Mono',monospace" }}>
                  Free at <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: "#00ff87", textDecoration: "none" }}>console.groq.com</a> · Never stored
                </p>
                {error && (
                  <div style={{ marginTop: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
                  <button onClick={() => setStep(2)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", borderRadius: 8, padding: "12px 24px", fontFamily: "'DM Mono',monospace", fontSize: 13, cursor: "pointer" }}>← Back</button>
                  <button onClick={evaluate} disabled={loading || !apiKey.trim()}
                    style={{ background: loading ? "#1a1a1a" : (apiKey.trim() ? "#00ff87" : "#1a1a1a"), color: loading ? "#555" : (apiKey.trim() ? "#000" : "#333"), border: "none", borderRadius: 8, padding: "14px 36px", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, cursor: (loading || !apiKey.trim()) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                    {loading && <div style={{ width: 14, height: 14, border: "2px solid #333", borderTopColor: "#888", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                    {loading ? "Evaluating..." : "Evaluate Match →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ animation: "fadeUp 0.5s ease forwards" }}>
            <EvalCard
              eval={evalResult}
              onReset={reset}
              onGenerateResume={generateResume}
              generatingResume={generatingResume}
            />
            {error && (
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>
            )}
            {resumeResult && (
              <div style={{ marginTop: 32 }}>
                <ResumePreview resume={resumeResult} onDownload={downloadDocx} downloading={downloading} />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#333", fontFamily: "'DM Mono',monospace" }}>Built on career-ops · Free · Open Source</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", textDecoration: "none" }}>Get Groq Key ↗</a>
            <a href="https://github.com/524himanshu/career-ops" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", textDecoration: "none" }}>GitHub ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}