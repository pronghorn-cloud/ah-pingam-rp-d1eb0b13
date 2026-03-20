import React, { useState, useEffect, useCallback } from 'react';
import { sessionsApi } from '../services/api';
import './PageStyles.css';

function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(statusFilter && { status: statusFilter })
      };

      const [sessionsRes, statsRes] = await Promise.all([
        sessionsApi.list(params),
        sessionsApi.getStats()
      ]);

      setSessions(sessionsRes.data || []);
      setStats(statsRes.data);
      setPagination(prev => ({
        ...prev,
        total: sessionsRes.pagination?.total || 0,
        totalPages: sessionsRes.pagination?.totalPages || 1
      }));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleEndSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to end this session?')) return;
    
    try {
      await sessionsApi.end(sessionId);
      fetchSessions();
    } catch (err) {
      alert('Failed to end session: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const classes = {
      active: 'badge badge-success',
      ended: 'badge badge-info',
      expired: 'badge badge-warning'
    };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  const formatDuration = (startedAt, endedAt) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diff = Math.floor((end - start) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Sessions</h1>
        <p className="page-subtitle">Monitor active and historical user sessions</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-title">Active Sessions</div>
            <div className="stat-card-value text-success">{stats.activeSessions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Avg Duration</div>
            <div className="stat-card-value">
              {stats.averageDurationSeconds 
                ? formatDuration(0, stats.averageDurationSeconds * 1000)
                : '-'
              }
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-title">Last 24h</div>
            <div className="stat-card-value">{stats.sessionsLast24Hours}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
          <option value="expired">Expired</option>
        </select>

        <button className="btn btn-outline" onClick={fetchSessions}>
          🔄 Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Sessions Table */}
      <div className="card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No sessions found</div>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Application</th>
                    <th>Realm</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Client IP</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-avatar">
                            {(session.username || session.user_id || '?').charAt(0).toUpperCase()}
                          </span>
                          <span>{session.username || session.user_id}</span>
                        </div>
                      </td>
                      <td>{session.application || '-'}</td>
                      <td>{session.realm || '-'}</td>
                      <td>{getStatusBadge(session.status)}</td>
                      <td className="text-muted">
                        {new Date(session.started_at).toLocaleString()}
                      </td>
                      <td>{formatDuration(session.started_at, session.ended_at)}</td>
                      <td className="text-muted">{session.client_ip || '-'}</td>
                      <td>
                        {session.status === 'active' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleEndSession(session.id)}
                          >
                            End
                          </button>
                        )}
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
                {pagination.total} sessions
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

export default Sessions;
