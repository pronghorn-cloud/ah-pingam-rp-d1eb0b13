import React from 'react';
import './StatsCard.css';

function StatsCard({ title, value, icon, color = 'default', change, changeType, subtext }) {
  return (
    <div className={`stats-card stats-card-${color}`} data-testid="stats-card">
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-content">
        <div className="stats-card-title">{title}</div>
        <div className="stats-card-value">{value}</div>
        {change && (
          <div className={`stats-card-change ${changeType}`}>
            {change}
          </div>
        )}
        {subtext && (
          <div className="stats-card-subtext">{subtext}</div>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
