import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/auth-context';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'DA', end: true },
  { to: '/members', label: 'Members', icon: 'ME' },
  { to: '/payments', label: 'Payments', icon: 'PY' },
  { to: '/packages', label: 'Gym plans', icon: 'GP' },
  { to: '/trainer-packages', label: 'Trainer plans', icon: 'TP' },
  { to: '/trainers', label: 'Trainers', icon: 'TR' },
  { to: '/fees', label: 'Fee table', icon: 'FE' },
  { to: '/alerts', label: 'Alerts', icon: 'AL', badge: true },
  { to: '/settings', label: 'Settings', icon: 'ST' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  const refreshAlerts = useCallback(() => {
    api
      .listAlerts(7)
      .then((data) => setAlertCount(data.total))
      .catch(() => setAlertCount(0));
  }, []);

  useEffect(() => {
    refreshAlerts();
    const id = window.setInterval(refreshAlerts, 60_000);
    return () => window.clearInterval(id);
  }, [refreshAlerts]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        HA Fitness
        <span>Management</span>
      </div>

      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && alertCount > 0 ? (
                <span className="nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <div className="sidebar-user">Signed in as {user?.username}</div>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    </aside>
  );
}
