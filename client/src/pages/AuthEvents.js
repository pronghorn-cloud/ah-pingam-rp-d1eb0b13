import React, { useState, useEffect, useCallback } from 'react';
import { authEventsApi } from '../services/api';
import './PageStyles.css';

function AuthEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    event_type: '',
    user_id: ''
  });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      };
      
      const response = await authEventsApi.list(params);
      setEvents(response.data || []);
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
    fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getStatusBadge = (status) => {
    const classes = {
      success: 'badge badge-success',
      failure: 'badge badge-danger',
      pending: 'badge badge-warning'
    };
    return <span className={classes[status] || 'badge'}>{status}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Authentication Events</h1>
        <p className="page-subtitle">View and filter authentication event logs</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="pending">Pending</option>
        </select>

        <input
          type="text"
          name="event_type"
          placeholder="Event Type"
          value={filters.event_type}
          onChange={handleFilterChange}
        />

        <input
          type="text"
          name="user_id"
          placeholder="User ID"
          value={filters.user_id}
          onChange={handleFilterChange}
        />

        <button className="btn btn-outline" onClick={fetchEvents}>
          🔄 Refresh
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="card">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No events found</div>
            <div className="empty-state-description">
              Try adjusting your filters or wait for new events
            </div>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>User</th>
                    <th>Application</th>
                    <th>Status</th>
                    <th>Client IP</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="text-muted">
                        {new Date(event.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <code className="event-type">{event.event_type}</code>
                      </td>
                      <td>
                        {event.username || event.user_id || '-'}
                      </td>
                      <td>{event.application || '-'}</td>
                      <td>{getStatusBadge(event.status)}</td>
                      <td className="text-muted">{event.client_ip || '-'}</td>
                      <td className="text-muted">
                        {event.duration_ms ? `${event.duration_ms}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} events
              </div>
              <div className="pagination-buttons">
                <button
                  className="btn btn-outline"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <span className="pagination-current">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  className="btn btn-outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
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

export default AuthEvents;
