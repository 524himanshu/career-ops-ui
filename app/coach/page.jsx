"use client";
import { useState, useEffect } from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat, UnderlineType, TabStopType } from "docx";
import { saveAs } from "file-saver";

// ─── GROQ ────────────────────────────────────────────────────────────────────

async function callGroq(apiKey, systemPrompt, userContent, maxTokens = 2000) {
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
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Groq error"); }
  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function callGroqText(apiKey, systemPrompt, userContent, maxTokens = 1500) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "Groq error"); }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ─── PROMPTS ─────────────────────────────────────────────────────────────────

const EVAL_PROMPT = `You are a senior technical recruiter. Analyze the JD and CV, return ONLY valid JSON:
{
  "score": <0-100>,
  "grade": "<A/B/C/D/F>",
  "role": "<role from JD>",
  "company": "<company from JD>",
  "strengths": ["<s1>","<s2>","<s3>"],
  "gaps": ["<g1>","<g2>","<g3>"],
  "keywords": ["<k1>","<k2>","<k3>","<k4>","<k5>"],
  "summary": "<2-3 sentence honest assessment>",
  "recommendation": "<apply/maybe/skip>"
}`;

const RESUME_PROMPT = `You are an expert resume writer. Return ONLY valid JSON:
{
  "name": "<from CV>",
  "title": "<role from JD>",
  "contact": "<email | phone | linkedin | github>",
  "summary": "<3 sentences tailored to JD, first person>",
  "skills": { "Frontend": "<relevant>", "Backend": "<relevant>", "AI/ML": "<if relevant>", "Tools": "<relevant>" },
  "projects": [{"name":"<n>","stack":"<s>","bullets":["<b1>","<b2>","<b3>"]}],
  "experience": [{"role":"<r>","company":"<c>","period":"<p>","bullets":["<b1>","<b2>"]}],
  "education": [{"degree":"<d>","institution":"<i>","period":"<p>","note":"<gpa>"}],
  "certifications": ["<c1>","<c2>","<c3>"],
  "cover_note": "<one strong paragraph, direct, no buzzwords>"
}
Only include top 3 most relevant projects. Rewrite bullets to match JD. No invented experience.`;

const INTERVIEW_PROMPT = `You are a senior technical interviewer. Given the JD and CV, return ONLY valid JSON:
{
  "role": "<role>",
  "company": "<company>",
  "questions": [
    {
      "type": "<Technical/Behavioral/System Design/Culture>",
      "question": "<the question>",
      "why": "<why they ask this>",
      "star_answer": "<a specific STAR answer written using the candidate's actual experience from their CV. Make it concrete and specific, not generic.>"
    }
  ]
}
Generate 8 questions: 3 technical, 2 behavioral, 1 system design, 1 culture fit, 1 curveball. Be realistic — these should be actual questions this company would ask for this specific role.`;

const OUTREACH_PROMPT = `You are an expert at professional outreach. Given the JD and CV, return ONLY valid JSON:
{
  "role": "<role>",
  "company": "<company>",
  "linkedin_dm": "<a short, direct LinkedIn DM to the hiring manager. Max 5 sentences. No fluff. Specific to this role and company. Don't start with 'Hi I saw your posting'. Be human.>",
  "email_subject": "<sharp email subject line>",
  "email_body": "<a 3 paragraph cold email. Para 1: why you're reaching out specifically. Para 2: one specific thing from your background that maps to their need. Para 3: clear ask. Professional but not corporate.>",
  "follow_up": "<a 2 sentence follow-up message to send after 1 week of no response>"
}`;

const SALARY_PROMPT = `You are a compensation expert. Given the role, company, and location, return ONLY valid JSON:
{
  "role": "<role>",
  "location": "<location>",
  "currency": "<local currency code>",
  "range": {
    "low": <number>,
    "mid": <number>,
    "high": <number>
  },
  "equity": "<typical equity range if startup, or N/A>",
  "breakdown": "<2-3 sentences explaining the range and what factors push it higher or lower>",
  "negotiation_tips": ["<tip1>","<tip2>","<tip3>"],
  "ask_for": <number — what the candidate should specifically ask for given their experience level>
}`;

// ─── DOCX ────────────────────────────────────────────────────────────────────

async function generateDocx(resume) {
  const FONT = "Calibri";
  const C = { dark: "1A1A1A", mid: "444444", light: "666666" };

  const sh = (text) => new Paragraph({
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

  const children = [
    new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: resume.name.toUpperCase(), bold: true, size: 52, font: FONT, color: C.dark })] }),
    new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: resume.title, size: 24, font: FONT, color: "1a56db", bold: true })] }),
    new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun({ text: resume.contact, size: 19, font: FONT, color: C.light })] }),
    sh("Summary"),
    new Paragraph({ spacing: { before: 80, after: 120 }, children: [new TextRun({ text: resume.summary, size: 20, font: FONT, color: C.mid })] }),
    sh("Technical Skills"),
    new Paragraph({ spacing: { before: 80, after: 0 }, children: [] }),
    ...Object.entries(resume.skills).filter(([, v]) => v?.trim()).map(([k, v]) => skillRow(k, v)),
    new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }),
    sh("Projects"),
    ...resume.projects.flatMap(p => [
      new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: p.name, bold: true, size: 21, font: FONT, color: C.dark }), new TextRun({ text: "  |  " + p.stack, size: 19, font: FONT, color: C.light, italics: true })] }),
      ...p.bullets.map(bul),
    ]),
    sh("Experience"),
    ...resume.experience.flatMap(e => [twoCol(`${e.role} · ${e.company}`, e.period), ...e.bullets.map(bul)]),
    sh("Education"),
    ...resume.education.flatMap(e => [
      twoCol(e.degree + " · " + e.institution, e.period),
      ...(e.note ? [new Paragraph({ spacing: { before: 20, after: 60 }, children: [new TextRun({ text: e.note, size: 19, font: FONT, color: C.light })] })] : []),
    ]),
    sh("Certifications"),
    ...resume.certifications.map(bul),
  ];

  const doc = new Document({
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 240 } }, run: { size: 20, font: FONT, color: C.mid } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 1080, bottom: 900, left: 1080 } } }, children }],
  });
  const buf = await Packer.toBlob(doc);
  saveAs(buf, `${resume.name.replace(/\s+/g, "_")}_Tailored_Resume.docx`);
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

const SCORE_COLORS = {
  A: { bg: "#0a2a1a", border: "#00ff87", text: "#00ff87" },
  B: { bg: "#1a2a0a", border: "#7fff00", text: "#7fff00" },
  C: { bg: "#2a1a00", border: "#ffaa00", text: "#ffaa00" },
  D: { bg: "#2a0a0a", border: "#ff4444", text: "#ff4444" },
  F: { bg: "#1a0000", border: "#ff0000", text: "#ff0000" },
};
const REC_COLORS = { apply: "#00ff87", maybe: "#ffaa00", skip: "#ff4444" };
const REC_LABELS = { apply: "Strong Apply", maybe: "Apply with Caution", skip: "Skip This One" };

function Chip({ children }) {
  return <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{children}</span>;
}

function Card({ children, style = {} }) {
  return <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px 24px", ...style }}>{children}</div>;
}

function SectionLabel({ children, color = "#555" }) {
  return <div style={{ fontSize: 11, color, fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 12 }}>{children}</div>;
}

function Spinner() {
  return <div style={{ width: 16, height: 16, border: "2px solid #333", borderTopColor: "#888", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />;
}

function ScoreRing({ score, grade }) {
  const radius = 54, circumference = 2 * Math.PI * radius;
  const colors = SCORE_COLORS[grade] || SCORE_COLORS.C;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="8" />
        <circle cx="65" cy="65" r={radius} fill="none" stroke={colors.border} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: colors.text, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>SCORE</span>
      </div>
    </div>
  );
}


function extractContact(cv) {
  const email =
    cv.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";

  const phone =
    cv.match(/(\+?\d[\d\s\-()]{8,})/)?.[0] || "";

  const linkedin =
    cv.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i)?.[0] || "";

  const github =
    cv.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i)?.[0] || "";

  const portfolio =
    cv.match(
      /https?:\/\/(?!.*(linkedin|github))[^\s]+|[a-zA-Z0-9-]+\.(vercel\.app|netlify\.app)/i
    )?.[0] || "";

  return [email, phone, linkedin, github, portfolio]
    .filter(Boolean)
    .join(" | ");
}

// ─── TAB: EVALUATE ───────────────────────────────────────────────────────────

function EvaluateTab({ jd, cv, apiKey, evalResult, setEvalResult, resumeResult, setResumeResult }) {
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const evaluate = async () => {
    if (!jd || !cv || !apiKey) { setError("Fill in all fields in the sidebar first."); return; }
    setLoading(true); setError(""); setEvalResult(null); setResumeResult(null);
    try { setEvalResult(await callGroq(apiKey, EVAL_PROMPT, `JD:\n${jd}\n\nCV:\n${cv}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

const generateResume = async () => {
  setGenLoading(true);
  setError("");

  try {
    const aiResume = await callGroq(
      apiKey,
      RESUME_PROMPT,
      `JD:\n${jd}\n\nCV:\n${cv}`
    );

    const extractedContact = extractContact(cv);

    setResumeResult({
      ...aiResume,
      contact: extractedContact,
    });
  } catch (e) {
    setError(e.message);
  } finally {
    setGenLoading(false);
  }
};
  const download = async () => {
    setDownloading(true);
    try { await generateDocx(resumeResult); }
    catch (e) { setError("DOCX failed: " + e.message); }
    finally { setDownloading(false); }
  };

  if (!evalResult) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Job Match Evaluator</h2>
          <p style={{ color: "#555", fontSize: 14 }}>Fill in the JD and CV in the sidebar, then evaluate your fit.</p>
        </div>
        {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>}
        <button onClick={evaluate} disabled={loading} style={{ width: "100%", padding: 18, borderRadius: 12, background: loading ? "#1a1a1a" : "linear-gradient(135deg,#00ff87,#00ccff)", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: loading ? "#555" : "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading && <Spinner />}{loading ? "Evaluating..." : "⚡ Evaluate Match"}
        </button>
      </div>
    );
  }

  const ev = evalResult;
  const colors = SCORE_COLORS[ev.grade] || SCORE_COLORS.C;
  const recColor = REC_COLORS[ev.recommendation] || "#888";

  return (
    <div style={{ animation: "fadeUp 0.4s ease forwards" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 6 }}>EVALUATION COMPLETE</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", margin: 0 }}>{ev.role}</h2>
          <div style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{ev.company}</div>
        </div>
        <button onClick={() => { setEvalResult(null); setResumeResult(null); }} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>← Reset</button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto", background: colors.bg, border: `1px solid ${colors.border}33`, borderRadius: 12, padding: "20px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <ScoreRing score={ev.score} grade={ev.grade} />
          <div>
            <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 6 }}>GRADE</div>
            <div style={{ fontSize: 52, fontWeight: 900, color: colors.text, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{ev.grade}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: `${recColor}10`, border: `1px solid ${recColor}33`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 8 }}>RECOMMENDATION</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: recColor, fontFamily: "'Syne',sans-serif" }}>{REC_LABELS[ev.recommendation]}</div>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>ASSESSMENT</SectionLabel>
        <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{ev.summary}</p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#001a0d", border: "1px solid #00ff8720", borderRadius: 12, padding: "18px 20px" }}>
          <SectionLabel color="#00ff87">STRENGTHS</SectionLabel>
          {ev.strengths.map((s, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}><span style={{ color: "#00ff87", flexShrink: 0 }}>✓</span><span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.5 }}>{s}</span></div>)}
        </div>
        <div style={{ background: "#1a0000", border: "1px solid #ff444420", borderRadius: 12, padding: "18px 20px" }}>
          <SectionLabel color="#ff4444">GAPS</SectionLabel>
          {ev.gaps.map((g, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}><span style={{ color: "#ff4444", flexShrink: 0 }}>✗</span><span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.5 }}>{g}</span></div>)}
        </div>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>ATS KEYWORDS</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{ev.keywords.map((k, i) => <Chip key={i}>{k}</Chip>)}</div>
      </Card>

      {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>}

      <button onClick={generateResume} disabled={genLoading} style={{ width: "100%", padding: 16, borderRadius: 12, background: genLoading ? "#1a1a1a" : "linear-gradient(135deg,#00ff87,#00ccff)", border: "none", cursor: genLoading ? "not-allowed" : "pointer", fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: genLoading ? "#555" : "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: resumeResult ? 24 : 0 }}>
        {genLoading && <Spinner />}{genLoading ? "Generating Resume..." : "⚡ Generate Tailored Resume + DOCX"}
      </button>

      {resumeResult && (
        <div style={{ marginTop: 8 }}>
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SectionLabel style={{ margin: 0 }}>TAILORED RESUME PREVIEW</SectionLabel>
              <button onClick={download} disabled={downloading} style={{ background: downloading ? "#1a1a1a" : "#1a56db", color: downloading ? "#555" : "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600, cursor: downloading ? "not-allowed" : "pointer" }}>
                {downloading ? "..." : "↓ Download DOCX"}
              </button>
            </div>
            <div style={{ padding: "28px 32px", fontFamily: "'DM Sans',sans-serif" }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#fff", margin: "0 0 4px" }}>{resumeResult.name}</h1>
              <div style={{ fontSize: 14, color: "#4488ff", fontWeight: 600, marginBottom: 6 }}>{resumeResult.title}</div>
              <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>{resumeResult.contact}</div>
              {[
                { title: "Summary", content: <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{resumeResult.summary}</p> },
                { title: "Skills", content: Object.entries(resumeResult.skills).filter(([, v]) => v?.trim()).map(([k, v]) => <div key={k} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: "#fff", fontSize: 12, fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{k}:</span><span style={{ color: "#666", fontSize: 12 }}>{v}</span></div>) },
                { title: "Projects", content: resumeResult.projects.map((p, i) => <div key={i} style={{ marginBottom: 16 }}><div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{p.name} <span style={{ color: "#333", fontWeight: 400 }}>| {p.stack}</span></div>{p.bullets.map((b, j) => <div key={j} style={{ display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: "#2a2a2a" }}>–</span><span style={{ color: "#888", fontSize: 12, lineHeight: 1.6 }}>{b}</span></div>)}</div>) },
              ].map((s, i) => (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#4488ff", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #1a1a1a" }}>{s.title.toUpperCase()}</div>
                  {s.content}
                </div>
              ))}
              {resumeResult.cover_note && (
                <div>
                  <div style={{ fontSize: 10, color: "#4488ff", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #1a1a1a" }}>COVER NOTE</div>
                  <p style={{ color: "#888", fontSize: 13, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{resumeResult.cover_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: INTERVIEW PREP ─────────────────────────────────────────────────────

function InterviewTab({ jd, cv, apiKey }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const generate = async () => {
    if (!jd || !cv || !apiKey) { setError("Fill in all sidebar fields first."); return; }
    setLoading(true); setError("");
    try { setResult(await callGroq(apiKey, INTERVIEW_PROMPT, `JD:\n${jd}\n\nCV:\n${cv}`, 2500)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const TYPE_COLORS = { Technical: "#00ccff", Behavioral: "#00ff87", "System Design": "#aa88ff", "Culture": "#ffcc00", Curveball: "#ff4488" };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Interview Prep</h2>
        <p style={{ color: "#555", fontSize: 14 }}>Get the questions they'll actually ask — with STAR answers built from your experience.</p>
      </div>
      {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>}
      {!result ? (
        <button onClick={generate} disabled={loading} style={{ width: "100%", padding: 18, borderRadius: 12, background: loading ? "#1a1a1a" : "linear-gradient(135deg,#ff9500,#ff4488)", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: loading ? "#555" : "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading && <Spinner />}{loading ? "Generating Questions..." : "🎯 Generate Interview Prep"}
        </button>
      ) : (
        <div style={{ animation: "fadeUp 0.4s ease forwards" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "#555" }}>{result.questions.length} questions for <span style={{ color: "#fff" }}>{result.role}</span> at <span style={{ color: "#fff" }}>{result.company}</span></div>
            <button onClick={() => setResult(null)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Reset</button>
          </div>
          {result.questions.map((q, i) => (
            <div key={i} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: "100%", padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14, textAlign: "left" }}>
                <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 4, fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 600, background: `${TYPE_COLORS[q.type] || "#444"}15`, color: TYPE_COLORS[q.type] || "#888", border: `1px solid ${TYPE_COLORS[q.type] || "#444"}33` }}>{q.type?.toUpperCase()}</span>
                <span style={{ fontSize: 14, color: "#ccc", lineHeight: 1.5, flex: 1 }}>{q.question}</span>
                <span style={{ color: "#444", flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>
              {open === i && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #141414" }}>
                  <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 2, marginBottom: 8, marginTop: 16 }}>WHY THEY ASK</div>
                  <p style={{ color: "#555", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{q.why}</p>
                  <div style={{ fontSize: 11, color: "#00ff87", fontFamily: "'DM Mono',monospace", letterSpacing: 2, marginBottom: 8 }}>YOUR STAR ANSWER</div>
                  <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7, background: "#060606", padding: "14px 16px", borderRadius: 8, border: "1px solid #1a1a1a" }}>{q.star_answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB: OUTREACH ───────────────────────────────────────────────────────────

function OutreachTab({ jd, cv, apiKey }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState({});

  const generate = async () => {
    if (!jd || !cv || !apiKey) { setError("Fill in all sidebar fields first."); return; }
    setLoading(true); setError("");
    try { setResult(await callGroq(apiKey, OUTREACH_PROMPT, `JD:\n${jd}\n\nCV:\n${cv}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const copy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
  };

  const MessageBox = ({ label, content, copyKey, color = "#4488ff" }) => (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionLabel color={color}>{label}</SectionLabel>
        <button onClick={() => copy(copyKey, content)} style={{ background: copied[copyKey] ? "#00ff8720" : "transparent", border: `1px solid ${copied[copyKey] ? "#00ff87" : "#2a2a2a"}`, color: copied[copyKey] ? "#00ff87" : "#555", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11, transition: "all 0.2s" }}>
          {copied[copyKey] ? "Copied!" : "Copy"}
        </button>
      </div>
      <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{content}</p>
    </Card>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Cold Outreach</h2>
        <p style={{ color: "#555", fontSize: 14 }}>LinkedIn DM, cold email, and follow-up — all personalized to the role.</p>
      </div>
      {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>}
      {!result ? (
        <button onClick={generate} disabled={loading} style={{ width: "100%", padding: 18, borderRadius: 12, background: loading ? "#1a1a1a" : "linear-gradient(135deg,#ff4488,#aa88ff)", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: loading ? "#555" : "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading && <Spinner />}{loading ? "Writing Messages..." : "✉️ Generate Outreach Messages"}
        </button>
      ) : (
        <div style={{ animation: "fadeUp 0.4s ease forwards" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "#555" }}>Messages for <span style={{ color: "#fff" }}>{result.role}</span> at <span style={{ color: "#fff" }}>{result.company}</span></div>
            <button onClick={() => setResult(null)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Reset</button>
          </div>
          <MessageBox label="LINKEDIN DM" content={result.linkedin_dm} copyKey="dm" color="#0077ff" />
          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color="#ff4488">EMAIL SUBJECT</SectionLabel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, margin: 0 }}>{result.email_subject}</p>
              <button onClick={() => copy("subject", result.email_subject)} style={{ background: copied.subject ? "#00ff8720" : "transparent", border: `1px solid ${copied.subject ? "#00ff87" : "#2a2a2a"}`, color: copied.subject ? "#00ff87" : "#555", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{copied.subject ? "Copied!" : "Copy"}</button>
            </div>
          </Card>
          <MessageBox label="COLD EMAIL" content={result.email_body} copyKey="email" color="#ff4488" />
          <MessageBox label="FOLLOW-UP (1 WEEK)" content={result.follow_up} copyKey="followup" color="#aa88ff" />
        </div>
      )}
    </div>
  );
}

// ─── TAB: SALARY ─────────────────────────────────────────────────────────────

function SalaryTab({ jd, apiKey }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [location, setLocation] = useState("");

  const estimate = async () => {
    if (!jd || !apiKey) { setError("Fill in JD and API key in the sidebar first."); return; }
    setLoading(true); setError("");
    try {
      setResult(await callGroq(apiKey, SALARY_PROMPT, `JD:\n${jd}\n\nLocation: ${location || "Not specified — make a reasonable assumption based on the JD"}`, 1000));
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Salary Estimator</h2>
        <p style={{ color: "#555", fontSize: 14 }}>Know your number before the interview call.</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 10 }}>WORK LOCATION (optional)</label>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Dubai, UAE  or  London, UK  or  Remote" style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, color: "#ccc", fontSize: 14, padding: "12px 16px", fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
      </div>
      {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>}
      {!result ? (
        <button onClick={estimate} disabled={loading} style={{ width: "100%", padding: 18, borderRadius: 12, background: loading ? "#1a1a1a" : "linear-gradient(135deg,#aa88ff,#ff4488)", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: loading ? "#555" : "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {loading && <Spinner />}{loading ? "Estimating..." : "💰 Estimate Salary Range"}
        </button>
      ) : (
        <div style={{ animation: "fadeUp 0.4s ease forwards" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#555" }}>{result.role} · {result.location}</div>
            <button onClick={() => setResult(null)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Reset</button>
          </div>

          {/* Range visual */}
          <div style={{ background: "#0a0a14", border: "1px solid #1a1a2a", borderRadius: 12, padding: "28px 28px", marginBottom: 16 }}>
            <SectionLabel color="#aa88ff">SALARY RANGE ({result.currency})</SectionLabel>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              {[
                { label: "Low", value: result.range.low, color: "#ff4444" },
                { label: "Mid", value: result.range.mid, color: "#ffaa00" },
                { label: "High", value: result.range.high, color: "#00ff87" },
              ].map(r => (
                <div key={r.label} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>{r.label.toUpperCase()}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: r.color }}>{r.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#111", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,#ff4444,#ffaa00,#00ff87)", borderRadius: 3 }} />
            </div>
          </div>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel color="#00ff87">ASK FOR</SectionLabel>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Syne',sans-serif", color: "#00ff87" }}>{result.ask_for?.toLocaleString()} {result.currency}</div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <SectionLabel>BREAKDOWN</SectionLabel>
            <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{result.breakdown}</p>
          </Card>

          {result.equity && result.equity !== "N/A" && (
            <Card style={{ marginBottom: 16 }}>
              <SectionLabel color="#ffcc00">EQUITY</SectionLabel>
              <p style={{ color: "#aaa", fontSize: 14, margin: 0 }}>{result.equity}</p>
            </Card>
          )}

          <Card>
            <SectionLabel color="#ff9500">NEGOTIATION TIPS</SectionLabel>
            {result.negotiation_tips?.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ color: "#ff9500", flexShrink: 0 }}>→</span>
                <span style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── TAB: TRACKER ────────────────────────────────────────────────────────────

const COLUMNS = ["Applied", "Interviewing", "Offer", "Rejected"];
const COL_COLORS = { Applied: "#4488ff", Interviewing: "#ffaa00", Offer: "#00ff87", Rejected: "#ff4444" };

function TrackerTab() {
  const [jobs, setJobs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ role: "", company: "", url: "", status: "Applied", note: "" });
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    try { const saved = localStorage.getItem("applyai_tracker"); if (saved) setJobs(JSON.parse(saved)); } catch (e) {}
  }, []);

  const save = (updated) => {
    setJobs(updated);
    try { localStorage.setItem("applyai_tracker", JSON.stringify(updated)); } catch (e) {}
  };

  const addJob = () => {
    if (!form.role || !form.company) return;
    save([...jobs, { ...form, id: Date.now(), date: new Date().toLocaleDateString() }]);
    setForm({ role: "", company: "", url: "", status: "Applied", note: "" });
    setAdding(false);
  };

  const moveJob = (id, status) => {
    save(jobs.map(j => j.id === id ? { ...j, status } : j));
  };

  const deleteJob = (id) => save(jobs.filter(j => j.id !== id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Application Tracker</h2>
          <p style={{ color: "#555", fontSize: 14 }}>{jobs.length} applications tracked · saved locally</p>
        </div>
        <button onClick={() => setAdding(!adding)} style={{ background: adding ? "transparent" : "linear-gradient(135deg,#00ff87,#00ccff)", color: adding ? "#555" : "#000", border: adding ? "1px solid #2a2a2a" : "none", borderRadius: 8, padding: "10px 20px", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {adding ? "Cancel" : "+ Add Job"}
        </button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>NEW APPLICATION</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { key: "role", placeholder: "Job title" },
              { key: "company", placeholder: "Company" },
              { key: "url", placeholder: "Job URL (optional)" },
            ].map(f => (
              <input key={f.key} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} style={{ background: "#080808", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 13, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
            ))}
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ background: "#080808", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 13, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", outline: "none" }}>
              {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ width: "100%", background: "#080808", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 13, padding: "10px 14px", fontFamily: "'DM Sans',sans-serif", outline: "none", resize: "vertical", marginBottom: 12 }} />
          <button onClick={addJob} style={{ background: "linear-gradient(135deg,#00ff87,#00ccff)", color: "#000", border: "none", borderRadius: 8, padding: "10px 24px", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add →</button>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {COLUMNS.map(col => (
          <div key={col} style={{ background: "#0a0a0c", border: "1px solid #141414", borderRadius: 12, padding: "16px", minHeight: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: COL_COLORS[col] }} />
              <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: COL_COLORS[col], letterSpacing: 1 }}>{col.toUpperCase()}</span>
              <span style={{ fontSize: 11, color: "#333", fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{jobs.filter(j => j.status === col).length}</span>
            </div>
            {jobs.filter(j => j.status === col).map(j => (
              <div key={j.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: "12px", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{j.role}</div>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>{j.company} · {j.date}</div>
                {j.note && <div style={{ fontSize: 11, color: "#444", marginBottom: 8, lineHeight: 1.5 }}>{j.note}</div>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COLUMNS.filter(c => c !== col).map(c => (
                    <button key={c} onClick={() => moveJob(j.id, c)} style={{ background: "transparent", border: `1px solid ${COL_COLORS[c]}33`, color: COL_COLORS[c], borderRadius: 4, padding: "3px 8px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>→ {c}</button>
                  ))}
                  <button onClick={() => deleteJob(j.id)} style={{ background: "transparent", border: "1px solid #ff444433", color: "#ff4444", borderRadius: 4, padding: "3px 8px", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "evaluate", label: "Evaluate", icon: "⚡" },
  { id: "interview", label: "Interview Prep", icon: "🎯" },
  { id: "outreach", label: "Outreach", icon: "✉️" },
  { id: "salary", label: "Salary", icon: "💰" },
  { id: "tracker", label: "Tracker", icon: "📋" },
];

export default function CoachPage() {
  const [tab, setTab] = useState("evaluate");
  const [jd, setJd] = useState("");
  const [cv, setCv] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [resumeResult, setResumeResult] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060608", color: "#fff", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input, select { outline: none !important; }
        textarea { resize: vertical; }
        ::selection { background: #00ff8730; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0a0a0c; }
        ::-webkit-scrollbar-thumb { background: #1e1e1e; border-radius: 3px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 300 : 60, flexShrink: 0, background: "#08080a", borderRight: "1px solid #111", display: "flex", flexDirection: "column", transition: "width 0.3s", overflow: "hidden", position: "sticky", top: 0, height: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #111", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#00ff87,#00ccff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚡</div>
          {sidebarOpen && <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, whiteSpace: "nowrap" }}>ApplyAI</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>
            {sidebarOpen ? "←" : "→"}
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {/* JD */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 8 }}>JOB DESCRIPTION</label>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste JD here..." rows={6} style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 12, padding: "10px 12px", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }} />
            </div>
            {/* CV */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 8 }}>YOUR CV</label>
              <textarea value={cv} onChange={e => setCv(e.target.value)} placeholder="Paste CV as plain text..." rows={6} style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 12, padding: "10px 12px", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }} />
            </div>
            {/* API Key */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", letterSpacing: 3, display: "block", marginBottom: 8 }}>GROQ API KEY</label>
              <div style={{ position: "relative" }}>
                <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="gsk_..." style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, color: "#ccc", fontSize: 12, padding: "10px 36px 10px 12px", fontFamily: "'DM Mono',monospace" }} />
                <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 12 }}>
                  {showKey ? "🙈" : "👁"}
                </button>
              </div>
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono',monospace", textDecoration: "none", display: "block", marginTop: 6 }}>
                Free at console.groq.com ↗
              </a>
            </div>

            {/* Status indicators */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[{ label: "JD", ok: jd.trim().length > 0 }, { label: "CV", ok: cv.trim().length > 0 }, { label: "API Key", ok: apiKey.trim().length > 0 }].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.ok ? "#00ff87" : "#1e1e1e", border: `1px solid ${s.ok ? "#00ff87" : "#2a2a2a"}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: s.ok ? "#00ff87" : "#333", fontFamily: "'DM Mono',monospace" }}>{s.label} {s.ok ? "ready" : "missing"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab bar */}
        <div style={{ borderBottom: "1px solid #111", padding: "0 24px", display: "flex", gap: 4, flexShrink: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "transparent", border: "none",
              borderBottom: tab === t.id ? "2px solid #00ff87" : "2px solid transparent",
              color: tab === t.id ? "#fff" : "#444",
              padding: "16px 16px 14px",
              fontFamily: "'DM Mono',monospace", fontSize: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              whiteSpace: "nowrap", transition: "color 0.2s",
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 32px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {tab === "evaluate" && <EvaluateTab jd={jd} cv={cv} apiKey={apiKey} evalResult={evalResult} setEvalResult={setEvalResult} resumeResult={resumeResult} setResumeResult={setResumeResult} />}
            {tab === "interview" && <InterviewTab jd={jd} cv={cv} apiKey={apiKey} />}
            {tab === "outreach" && <OutreachTab jd={jd} cv={cv} apiKey={apiKey} />}
            {tab === "salary" && <SalaryTab jd={jd} apiKey={apiKey} />}
            {tab === "tracker" && <TrackerTab />}
          </div>
        </div>
      </div>
    </div>
  );
}