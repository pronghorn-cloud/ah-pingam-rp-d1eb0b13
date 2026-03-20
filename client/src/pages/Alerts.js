import React, { useState, useEffect, useCallback } from 'react';
import { alertsApi } from '../services/api';
import './PageStyles.css';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    severity: ''
  });

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      };

      const response = await alertsApi.list(params);
      setAlerts(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 1
      }));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId) => {
    try {
      await alertsApi.acknowledge(alertId, 'admin');
      fetchAlerts();
    } catch (err) {
      alert('Failed to acknowledge alert: ' + err.message);
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await alertsApi.resolve(alertId, 'admin');
      fetchAlerts();
    } catch (err) {
      alert('Failed to resolve alert: ' + err.message);
    }
  };

  const getSeverityBadge = (severity) => {
    const classes = {
      critical: 'badge badge-danger',
      warning: 'badge badge-warning',
      info: 'badge badge-info'
    };
    return <span className={classes[severity] || 'badge'}>{severity}</span>;
  };

  const getStatusBadge = (status) => {
    const classes = {
      active: 'badge badge-danger',
      acknowledged: 'badge badge-warning',
      resolved: 'badge badge-success'
    };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Alerts</h1>
        <p className="page-subtitle">Monitor and manage system alerts</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          name="severity"
          value={filters.severity}
          onChange={handleFilterChange}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <button className="btn btn-outline" onClick={fetchAlerts}>
          🔄 Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Alerts Table */}
      <div className="card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <div className="empty-state-title">No alerts found</div>
            <div className="empty-state-description">
              All clear! No alerts match your filters.
            </div>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Triggered</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id} className={`alert-row severity-${alert.severity}`}>
                      <td>{getSeverityBadge(alert.severity)}</td>
                      <td>
                        <div className="alert-title-cell">
                          <strong>{alert.title}</strong>
                          {alert.description && (
                            <p className="alert-description">{alert.description}</p>
                          )}
                        </div>
                      </td>
                      <td><code>{alert.alert_type}</code></td>
                      <td>{getStatusBadge(alert.status)}</td>
                      <td className="text-muted">
                        {new Date(alert.triggered_at).toLocaleString()}
                      </td>
                      <td className="text-muted">{alert.source || '-'}</td>
                      <td>
                        <div className="action-buttons">
                          {alert.status === 'active' && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              Acknowledge
                            </button>
                          )}
                          {(alert.status === 'active' || alert.status === 'acknowledged') && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleResolve(alert.id)}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} alerts
              </div>
              <div className="pagination-buttons">
                <button
                  className="btn btn-outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </button>
                <span className="pagination-current">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  className="btn btn-outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Alerts;
