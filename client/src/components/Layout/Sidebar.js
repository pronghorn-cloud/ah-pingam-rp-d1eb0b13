import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const menuItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📊'
  },
  {
    path: '/auth-events',
    label: 'Auth Events',
    icon: '🔐'
  },
  {
    path: '/sessions',
    label: 'Sessions',
    icon: '👥'
  },
  {
    path: '/alerts',
    label: 'Alerts',
    icon: '🔔'
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: '📈'
  }
];

function Sidebar() {
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">🛡️</span>
          <span className="logo-text">PingAM</span>
        </div>
        <div className="sidebar-subtitle">Analytics Dashboard</div>
      </div>
      
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <div className="version-info">v1.0.0</div>
        <div className="platform-badge">Power Platform</div>
      </div>
    </aside>
  );
}

export default Sidebar;
