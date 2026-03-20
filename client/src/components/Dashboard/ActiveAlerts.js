import React from 'react';
import { Link } from 'react-router-dom';
import './ActiveAlerts.css';

function ActiveAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✅</div>
        <p>No active alerts</p>
      </div>
    );
  }

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'warning': return 'severity-warning';
      default: return 'severity-info';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      default: return '🔵';
    }
  };

  return (
    <div className="alerts-list">
      {alerts.slice(0, 5).map((alert) => (
        <div key={alert.id} className={`alert-item ${getSeverityClass(alert.severity)}`}>
          <div className="alert-icon">{getSeverityIcon(alert.severity)}</div>
          <div className="alert-content">
            <div className="alert-title">{alert.title}</div>
            <div className="alert-meta">
              <span className="alert-type">{alert.alert_type}</span>
              <span className="alert-time">
                {new Date(alert.triggered_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {alerts.length > 5 && (
        <Link to="/alerts" className="view-all-link">
          View all {alerts.length} alerts →
        </Link>
      )}
    </div>
  );
}

export default ActiveAlerts;
