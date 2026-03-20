import React, { useState, useEffect, useCallback } from 'react';
import { metricsApi, alertsApi } from '../services/api';
import StatsCard from '../components/Dashboard/StatsCard';
import AuthTrendsChart from '../components/Dashboard/AuthTrendsChart';
import TopUsersTable from '../components/Dashboard/TopUsersTable';
import ApplicationsChart from '../components/Dashboard/ApplicationsChart';
import ActiveAlerts from '../components/Dashboard/ActiveAlerts';
import './Dashboard.css';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [authTrends, setAuthTrends] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, trendsRes, usersRes, appsRes, alertsRes] = await Promise.all([
        metricsApi.getOverview(),
        metricsApi.getAuthTrends({ period: 'day' }),
        metricsApi.getTopUsers(10),
        metricsApi.getByApplication(),
        alertsApi.getActive()
      ]);

      setOverview(overviewRes.data);
      setAuthTrends(trendsRes.data?.trends || []);
      setTopUsers(usersRes.data || []);
      setApplications(appsRes.data || []);
      setAlerts(alertsRes.data?.alerts || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDashboardData, refreshKey]);

  if (loading && !overview) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="mt-3 text-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="alert alert-error">
        <strong>Error:</strong> {error}
        <button className="btn btn-outline mt-3" onClick={fetchDashboardData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Real-time PingAM authentication analytics</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <StatsCard
          title="Auth Events (24h)"
          value={overview?.authenticationEvents?.total || 0}
          icon="🔐"
          change={`${overview?.authenticationEvents?.successRate || 100}% success rate`}
          changeType="neutral"
        />
        <StatsCard
          title="Successful"
          value={overview?.authenticationEvents?.success || 0}
          icon="✅"
          color="success"
        />
        <StatsCard
          title="Failed"
          value={overview?.authenticationEvents?.failure || 0}
          icon="❌"
          color="danger"
        />
        <StatsCard
          title="Active Sessions"
          value={overview?.activeSessions || 0}
          icon="👥"
          color="info"
        />
        <StatsCard
          title="Active Alerts"
          value={overview?.alerts?.total || 0}
          icon="🔔"
          color={overview?.alerts?.critical > 0 ? 'danger' : 'warning'}
          subtext={overview?.alerts?.critical > 0 ? `${overview.alerts.critical} critical` : null}
        />
        <StatsCard
          title="Avg Response Time"
          value={`${overview?.averageResponseTimeMs || 0}ms`}
          icon="⚡"
          color="info"
        />
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid mt-5">
        <div className="col-span-8">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Authentication Trends</h3>
              <span className="text-muted text-sm">Last 24 hours</span>
            </div>
            <div className="chart-container">
              <AuthTrendsChart data={authTrends} />
            </div>
          </div>
        </div>

        <div className="col-span-4">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active Alerts</h3>
              <span className="badge badge-danger">{alerts.length}</span>
            </div>
            <ActiveAlerts alerts={alerts} />
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="dashboard-grid mt-4">
        <div className="col-span-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Top Users (24h)</h3>
            </div>
            <TopUsersTable users={topUsers} />
          </div>
        </div>

        <div className="col-span-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">By Application</h3>
            </div>
            <div className="chart-container-sm">
              <ApplicationsChart data={applications} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
