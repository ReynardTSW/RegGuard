import React from 'react';

const fmt = (val) => val.toLocaleString();
const fmtMinutes = (mins) => `${mins.toFixed(1)} min`;
const fmtHours = (hrs) => `${hrs.toFixed(1)} hrs`;
const fmtMoney = (usd) => `$${Math.max(0, Math.round(usd))}`;

export default function BeforeAfterPanel({
  totalRules = 0,
  processingMs = 0,
  manualHoursBaseline = 4.5,
  hourlyRate = 100,
}) {
  const processedMinutes = Math.max(1, processingMs / 60000 || 1);
  const processedHours = processedMinutes / 60;
  const manualHours = Math.max(manualHoursBaseline, (totalRules * 2.2) / 60); // 2.2 min/rule fallback
  const timeSavedHours = Math.max(0, manualHours - processedHours);
  const valueSaved = timeSavedHours * hourlyRate;

  return (
    <div className="glass-panel before-after-panel">
      <div className="before-after-header">
        <span role="img" aria-label="lightning">⚡</span>
        <span>Before / After Comparison</span>
        <div className="badge">Dynamic per document</div>
      </div>
      <div className="before-after-grid">
        <div className="before-card">
          <div className="label">❌ BEFORE (Manual Process)</div>
          <ul>
            <li>Analyst reads 50-page PDPA PDF</li>
            <li>Manually highlights “shall” statements</li>
            <li>Copy-pastes into Excel (2-3 hours)</li>
            <li>Manually categorizes by risk</li>
            <li>Creates checklist in Word (1 hour)</li>
          </ul>
          <div className="time-row">⏱️ Total time: {fmtHours(manualHours)}</div>
        </div>
        <div className="after-card">
          <div className="label">✅ AFTER (ReguGuard)</div>
          <ul>
            <li>Upload PDF (10 seconds)</li>
            <li>AI extracts {fmt(totalRules)} obligations</li>
            <li>Auto-categorized by severity</li>
            <li>Interactive checklist generated</li>
          </ul>
          <div className="time-row">
            ⏱️ Total time: {fmtMinutes(processedMinutes)} (≈ {fmtHours(processedHours)})
          </div>
          <div className="value-row">
            💰 Value: 95%+ time reduction = {fmtMoney(valueSaved)} saved per audit
          </div>
        </div>
      </div>
      <div className="fineprint">
        Updated automatically from the latest upload. Savings use {hourlyRate}/hr and per-rule manual effort; adjust in code if your rate differs.
      </div>
    </div>
  );
}
