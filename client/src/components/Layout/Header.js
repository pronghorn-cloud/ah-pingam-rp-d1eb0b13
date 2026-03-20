import React, { useState, useEffect } from 'react';
import './Header.css';

function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="header" data-testid="header">
      <div className="header-left">
        <button className="mobile-menu-btn" aria-label="Toggle menu">
          ☰
        </button>
      </div>
      
      <div className="header-right">
        <div className="header-datetime">
          <span className="header-date">{formatDate(currentTime)}</span>
          <span className="header-time">{formatTime(currentTime)}</span>
        </div>
        
        <div className="header-status">
          <span className="status-indicator online"></span>
          <span className="status-text">System Online</span>
        </div>
        
        <button className="header-refresh-btn" title="Refresh Data">
          🔄
        </button>
      </div>
    </header>
  );
}

export default Header;
