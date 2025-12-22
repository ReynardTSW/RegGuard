import React from 'react';

const formatNumber = (n) => n.toLocaleString();

const formatDuration = (ms) => {
  if (!ms || ms < 1000) return `${Math.round(ms || 0)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
};

export default function MetricsDashboard({
  totalRules = 0,
  highPriority = 0,
  mediumLow = 0,
  timeSavedHours = 0,
  processingMs = 0,
}) {
  const cards = [
    { label: 'Total Obligations Detected', value: formatNumber(totalRules) },
    { label: 'High-Priority Actions Required', value: formatNumber(highPriority) },
    { label: 'Medium/Low Advisory Items', value: formatNumber(mediumLow) },
    { label: 'Estimated Analyst Time Saved', value: `$${formatNumber(Math.round(timeSavedHours * 100))}` },
  ];

  return (
    <div className="glass-panel metrics-panel">
      <div className="metrics-header">
        <span role="img" aria-label="chart">📊</span>
        <span>Analysis Summary</span>
        <span className="metrics-processing">Last run: {formatDuration(processingMs)}</span>
      </div>
      <div className="metrics-grid">
        {cards.map((card) => (
          <div key={card.label} className="metrics-card">
            <div className="metrics-value">{card.value}</div>
            <div className="metrics-label">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
