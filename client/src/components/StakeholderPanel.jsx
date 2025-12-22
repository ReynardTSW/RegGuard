import React, { useMemo } from 'react';

const PROFILES = [
  {
    id: 'compliance-analyst',
    icon: '🔹',
    title: 'Compliance Analysts',
    problem: 'Spend 40% of time reading regulations',
    solution: 'Instant obligation extraction + checklist',
    keywords: ['shall', 'must', 'regulation', 'obligation', 'section', 'chapter', 'interpretation', 'compliance'],
  },
  {
    id: 'dpo',
    icon: '🔹',
    title: 'Data Protection Officers',
    problem: 'Hard to track which PDPA sections apply to new projects',
    solution: 'Keyword search + chatbot for instant answers',
    keywords: ['personal data', 'controller', 'processor', 'consent', 'notice', 'retention', 'transfer', 'data protection', 'dpo'],
  },
  {
    id: 'it-auditor',
    icon: '🔹',
    title: 'IT Auditors',
    problem: 'Creating audit checklists from scratch each time',
    solution: 'Pre-built, regulation-mapped control templates',
    keywords: ['security', 'access', 'audit', 'log', 'encryption', 'system', 'technical', 'controls', 'monitor'],
  },
  {
    id: 'grc-consultant',
    icon: '🔹',
    title: 'GRC Consultants',
    problem: 'Billable hours wasted on manual research',
    solution: '95% faster compliance scoping',
    keywords: ['risk', 'governance', 'policy', 'framework', 'assessment', 'control', 'scope', 'gap analysis'],
  },
];

const scoreProfile = (text, keywords) => {
  const lower = text;
  let score = 0;
  keywords.forEach((kw) => {
    const occurrences = lower.split(kw.toLowerCase()).length - 1;
    score += occurrences;
  });
  return score;
};

export default function StakeholderPanel({ rules = [] }) {
  const corpus = useMemo(() => rules.map((r) => r.text || '').join(' ').toLowerCase(), [rules]);

  const scored = useMemo(() => {
    if (!corpus.trim()) return PROFILES.map((p) => ({ ...p, score: 0 }));
    return PROFILES.map((p) => ({
      ...p,
      score: scoreProfile(corpus, p.keywords),
    })).sort((a, b) => b.score - a.score);
  }, [corpus]);

  return (
    <div className="glass-panel stakeholder-panel">
      <div className="stakeholder-header">
        <span role="img" aria-label="target">🎯</span>
        <span>Target Users</span>
        <span className="stakeholder-note">Inferred from document language</span>
      </div>
      <div className="stakeholder-grid">
        {scored.map((p) => (
          <div key={p.id} className="stakeholder-card">
            <div className="stakeholder-title">
              <span style={{ marginRight: '0.35rem' }}>{p.icon}</span> <strong>{p.title}</strong>
              <span className="stakeholder-score">Score {p.score}</span>
            </div>
            <div className="stakeholder-line"><strong>Problem:</strong> {p.problem}</div>
            <div className="stakeholder-line"><strong>Solution:</strong> {p.solution}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
