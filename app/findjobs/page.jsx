"use client";
import { useState } from "react";

const ADZUNA_APP_ID = process.env.NEXT_PUBLIC_ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.NEXT_PUBLIC_ADZUNA_APP_KEY;

const COUNTRIES = [
  { code: "gb", label: "UK" },
  { code: "us", label: "USA" },
  { code: "au", label: "Australia" },
  { code: "de", label: "Germany" },
  { code: "in", label: "India" },
  { code: "ca", label: "Canada" },
  { code: "ae", label: "UAE" },
  { code: "sg", label: "Singapore" },
  { code: "nl", label: "Netherlands" },
];

const EVAL_PROMPT = `You are a senior technical recruiter. Given this job description and CV, return ONLY valid JSON:
{
  "score": <0-100>,
  "grade": "<A/B/C/D/F>",
  "recommendation": "<apply/maybe/skip>",
  "one_liner": "<one sentence honest assessment>"
}
Be strict. Only return JSON.`;

const SCORE_COLORS = {
  A: "#00ff87", B: "#7fff00", C: "#ffaa00", D: "#ff4444", F: "#ff0000",
};
const REC_COLORS = { apply: "#00ff87", maybe: "#ffaa00", skip: "#ff4444" };
const REC_LABELS = { apply: "Strong Apply", maybe: "Maybe", skip: "Skip" };

async function quickEval(apiKey, jdText, cv) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: EVAL_PROMPT },
        { role: "user", content: `JD:\n${jdText.slice(0, 1500)}\n\nCV:\n${cv.slice(0, 1500)}` },
      ],
      temperature: 0.2,
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error("Groq error");
  const data = await res.json();
  const text = data.choices[0].message.content.trim();
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function ScoreBadge({ score, grade }) {
  const color = SCORE_COLORS[grade] || "#888";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'DM Mono',monospace" }}>{score}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "'Syne',sans-serif" }}>{grade}</div>
    </div>
  );
}

function JobCard({ job, cv, apiKey, onEvaluateFull }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const evaluate = async (e) => {
    e.stopPropagation();
    if (!cv || !apiKey) { setError("Add CV and API key in sidebar first."); return; }
    setLoading(true); setError("");
    try {
      const jdText = `${job.title} at ${job.company.display_name}. ${job.description}`;
      const res = await quickEval(apiKey, jdText, cv);
      setResult(res);
    } catch (e) {
      setError("Eval failed");
    } finally {
      setLoading(false);
    }
  };

  const recColor = result ? (REC_COLORS[result.recommendation] || "#888") : null;

  return (
    <div style={{
      background: "#0a0a0c", border: `1px solid ${result ? (recColor + "33") : "#141414"}`,
      borderRadius: 12, overflow: "hidden", transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Syne',sans-serif", margin: 0 }}>{job.title}</h3>
            {result && (
              <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", padding: "2px 8px", borderRadius: 4, background: `${recColor}15`, color: recColor, border: `1px solid ${recColor}33` }}>
                {REC_LABELS[result.recommendation]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>
            {job.company.display_name} · {job.location.display_name}
          </div>
          {job.salary_min && (
            <div style={{ fontSize: 12, color: "#00ff8788", fontFamily: "'DM Mono',monospace" }}>
              {Math.round(job.salary_min).toLocaleString()} – {Math.round(job.salary_max).toLocaleString()}
            </div>
          )}
          {result?.one_liner && (
            <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>{result.one_liner}</p>
          )}
          {error && <p style={{ fontSize: 11, color: "#ff4444", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>{error}</p>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
          {result ? (
            <ScoreBadge score={result.score} grade={result.grade} />
          ) : (
            <button onClick={evaluate} disabled={loading} style={{
              background: loading ? "#1a1a1a" : "#1a1a2a",
              border: "1px solid #2a2a3a", color: loading ? "#444" : "#4488ff",
              borderRadius: 8, padding: "8px 14px", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}>
              {loading ? (
                <><div style={{ width: 10, height: 10, border: "1.5px solid #333", borderTopColor: "#4488ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scoring...</>
              ) : "⚡ Score Me"}
            </button>
          )}
          <span style={{ fontSize: 14, color: "#2a2a2a", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: "1px solid #111", padding: "16px 20px" }}>
          <p style={{ color: "#666", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
            {job.description?.slice(0, 500)}{job.description?.length > 500 ? "..." : ""}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={job.redirect_url} target="_blank" rel="noreferrer" style={{
              background: "#fff", color: "#000", borderRadius: 8, padding: "8px 18px",
              fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600,
              textDecoration: "none", display: "inline-block",
            }}>
              Apply ↗
            </a>
            {result && (
              <button onClick={() => onEvaluateFull(job)} style={{
                background: "linear-gradient(135deg,#00ff87,#00ccff)", color: "#000",
                border: "none", borderRadius: 8, padding: "8px 18px",
                fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                Full Prep →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindJobsTab({ cv, apiKey, onJobSelect }) {
  const [query, setQuery] = useState("software engineer");
  const [country, setCountry] = useState("gb");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [autoScore, setAutoScore] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState(0);
  const [jobResults, setJobResults] = useState({});

  const search = async () => {
    setLoading(true); setError(""); setJobs([]); setJobResults({}); setSearched(false);
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=15&what=${encodeURIComponent(query)}&content-type=application/json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Adzuna API error " + res.status);
      const data = await res.json();
      if (!data.results?.length) throw new Error("No jobs found. Try different keywords.");
      setJobs(data.results);
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const autoScoreAll = async () => {
    if (!cv || !apiKey) { setError("Add CV and API key in sidebar first."); return; }
    setScoring(true); setScoreProgress(0);
    const top5 = jobs.slice(0, 5);
    for (let i = 0; i < top5.i; i++) {
      const job = top5[i];
      try {
        const jdText = `${job.title} at ${job.company.display_name}. ${job.description}`;
        const res = await quickEval(apiKey, jdText, cv);
        setJobResults(prev => ({ ...prev, [job.id]: res }));
      } catch (e) {}
      setScoreProgress(i + 1);
      await new Promise(r => setTimeout(r, 500));
    }
    setScoring(false);
  };

  const handleJobSelect = (job) => {
    const jdText = `Role: ${job.title}\nCompany: ${job.company.display_name}\nLocation: ${job.location.display_name}\n\n${job.description}`;
    onJobSelect(jdText);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Find Jobs</h2>
        <p style={{ color: "#555", fontSize: 14 }}>Search live job listings and score your fit before you apply.</p>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="e.g. frontend engineer, python developer..."
          style={{
            flex: 1, minWidth: 200, background: "#0d0d0d", border: "1px solid #1e1e1e",
            borderRadius: 10, color: "#ccc", fontSize: 14, padding: "12px 16px",
            fontFamily: "'DM Sans',sans-serif", outline: "none",
          }}
        />
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          style={{
            background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10,
            color: "#ccc", fontSize: 13, padding: "12px 14px",
            fontFamily: "'DM Mono',monospace", outline: "none", cursor: "pointer",
          }}
        >
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <button onClick={search} disabled={loading} style={{
          background: loading ? "#1a1a1a" : "linear-gradient(135deg,#00ff87,#00ccff)",
          color: loading ? "#555" : "#000", border: "none", borderRadius: 10,
          padding: "12px 24px", fontFamily: "'DM Mono',monospace", fontSize: 13,
          fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        }}>
          {loading ? (
            <><div style={{ width: 14, height: 14, border: "2px solid #333", borderTopColor: "#888", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Searching...</>
          ) : "Search →"}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#1a0000", border: "1px solid #ff444433", borderRadius: 8, color: "#ff6666", fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{error}</div>
      )}

      {/* Results header */}
      {searched && jobs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono',monospace" }}>
            {jobs.length} jobs found · <span style={{ color: "#fff" }}>{query}</span> · {COUNTRIES.find(c => c.code === country)?.label}
          </div>
          <button onClick={autoScoreAll} disabled={scoring || !cv || !apiKey} style={{
            background: scoring ? "#1a1a1a" : "#0a1a2a",
            border: "1px solid #1a3a5a", color: scoring ? "#444" : "#4488ff",
            borderRadius: 8, padding: "8px 16px", cursor: (scoring || !cv || !apiKey) ? "not-allowed" : "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {scoring ? (
              <><div style={{ width: 10, height: 10, border: "1.5px solid #333", borderTopColor: "#4488ff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Scoring {scoreProgress}/5...</>
            ) : "⚡ Auto-score top 5"}
          </button>
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              cv={cv}
              apiKey={apiKey}
              onEvaluateFull={handleJobSelect}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#2a2a2a" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 14, fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>Search for jobs above</div>
          <div style={{ fontSize: 12, color: "#1a1a1a", marginTop: 8 }}>Then score your fit with one click per listing</div>
        </div>
      )}
    </div>
  );
}