import React, { useState, useEffect } from 'react';
import { reportsApi } from '../services/api';
import './PageStyles.css';

function Reports() {
  const [summary, setSummary] = useState(null);
  const [securityReport, setSecurityReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('day');
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const [summaryRes, securityRes] = await Promise.all([
          reportsApi.getSummary({ period }),
          reportsApi.getSecurity({ period })
        ]);
        setSummary(summaryRes.data);
        setSecurityReport(securityRes.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [period]);

  const handleExport = async (type, format) => {
    try {
      const response = await reportsApi.exportData({ type, format, period });
      
      if (format === 'csv') {
        // Download CSV file
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_report_${period}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Download JSON file
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_report_${period}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="mt-3 text-muted">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Analytics and security reports</p>
      </div>

      {/* Period Selector & Export */}
      <div className="filter-bar">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="day">Last 24 Hours</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>

        <div className="export-buttons">
          <button 
            className="btn btn-outline"
            onClick={() => handleExport('auth_events', 'csv')}
          >
            📥 Export Auth Events (CSV)
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => handleExport('sessions', 'csv')}
          >
            📥 Export Sessions (CSV)
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && summary && (
        <div className="report-content">
          <div className="report-section">
            <h3>Authentication Summary</h3>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-title">Total Events</div>
                <div className="stat-card-value">{summary.authentication.total_events}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Success Rate</div>
                <div className="stat-card-value text-success">{summary.authentication.successRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Unique Users</div>
                <div className="stat-card-value">{summary.authentication.unique_users}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Unique IPs</div>
                <div className="stat-card-value">{summary.authentication.unique_ips}</div>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h3>Session Summary</h3>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-title">Total Sessions</div>
                <div className="stat-card-value">{summary.sessions.total_sessions}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Active</div>
                <div className="stat-card-value text-success">{summary.sessions.active}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Ended</div>
                <div className="stat-card-value">{summary.sessions.ended}</div>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h3>Top Applications</h3>
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Success</th>
                    <th className="text-right">Failure</th>
                    <th className="text-right">Success Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topApplications?.map((app, index) => (
                    <tr key={index}>
                      <td>{app.application}</td>
                      <td className="text-right">{app.total}</td>
                      <td className="text-right text-success">{app.success}</td>
                      <td className="text-right text-danger">{app.failure}</td>
                      <td className="text-right">
                        {app.total > 0 ? ((app.success / app.total) * 100).toFixed(1) : 100}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && securityReport && (
        <div className="report-content">
          <div className="report-section">
            <h3>Security Overview</h3>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-title">Suspicious IPs</div>
                <div className="stat-card-value text-danger">
                  {securityReport.summary.suspiciousIPCount}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Suspicious Users</div>
                <div className="stat-card-value text-warning">
                  {securityReport.summary.suspiciousUserCount}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-title">Critical Alerts</div>
                <div className="stat-card-value text-danger">
                  {securityReport.summary.criticalAlertCount}
                </div>
              </div>
            </div>
          </div>

          {securityReport.suspiciousIPs?.length > 0 && (
            <div className="report-section">
              <h3>Suspicious IP Addresses</h3>
              <p className="text-muted mb-3">IPs with 5+ failed authentication attempts</p>
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th className="text-right">Failed Attempts</th>
                      <th className="text-right">Targeted Users</th>
                      <th>First Attempt</th>
                      <th>Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityReport.suspiciousIPs.map((ip, index) => (
                      <tr key={index}>
                        <td><code>{ip.client_ip}</code></td>
                        <td className="text-right text-danger">{ip.failure_count}</td>
                        <td className="text-right">{ip.targeted_users}</td>
                        <td className="text-muted">
                          {new Date(ip.first_attempt).toLocaleString()}
                        </td>
                        <td className="text-muted">
                          {new Date(ip.last_attempt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {securityReport.errorDistribution?.length > 0 && (
            <div className="report-section">
              <h3>Error Distribution</h3>
              <div className="card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Error Code</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityReport.errorDistribution.map((err, index) => (
                      <tr key={index}>
                        <td><code>{err.error_code}</code></td>
                        <td className="text-right">{err.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Reports;
