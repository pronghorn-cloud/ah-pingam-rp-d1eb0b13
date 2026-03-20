import React from 'react';
import './TopUsersTable.css';

function TopUsersTable({ users }) {
  if (!users || users.length === 0) {
    return (
      <div className="empty-state">
        <p>No user data available</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th className="text-right">Events</th>
            <th className="text-right">Success</th>
            <th className="text-right">Failed</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.user_id || index}>
              <td>
                <div className="user-cell">
                  <span className="user-avatar">
                    {(user.username || user.user_id || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="user-info">
                    <span className="user-name">{user.username || user.user_id}</span>
                    {user.username && user.user_id && (
                      <span className="user-id">{user.user_id}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-right">
                <strong>{user.total_events}</strong>
              </td>
              <td className="text-right text-success">
                {user.success_count}
              </td>
              <td className="text-right text-danger">
                {user.failure_count}
              </td>
              <td className="text-muted">
                {user.last_activity 
                  ? new Date(user.last_activity).toLocaleString()
                  : '-'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TopUsersTable;
