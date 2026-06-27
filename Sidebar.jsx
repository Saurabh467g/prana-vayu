import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  Flame, 
  Locate, 
  TrendingUp, 
  BookOpen, 
  Database,
  CloudSun,
  Sun,
  Moon
} from 'lucide-react';

const Sidebar = ({ activeSection, setActiveSection, status, theme, setTheme }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'aqi-maps', label: 'Surface AQI Maps', icon: Map },
    { id: 'hcho-hotspots', label: 'HCHO Hotspots', icon: Flame },
    { id: 'source-regions', label: 'Source Regions', icon: Locate },
    { id: 'correlation', label: 'Fire-HCHO Correlation', icon: TrendingUp },
    { id: 'trends', label: 'Time Series / Trends', icon: BookOpen },
    { id: 'methodology', label: 'Data & Methodology', icon: Database },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <CloudSun className="sidebar-logo" size={32} />
        <h1 className="sidebar-title">PRANA-VAYU</h1>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-badge">
          <span className="badge-dot" style={{ 
            backgroundColor: status?.mock_mode ? '#f59e0b' : '#10b981',
            boxShadow: status?.mock_mode ? '0 0 6px #f59e0b' : '0 0 6px #10b981'
          }}></span>
          <span>
            {status?.mock_mode 
              ? 'SIMULATED DATA MODE' 
              : 'LIVE SATELLITE FEED'}
          </span>
        </div>
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className="theme-toggle-btn"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
