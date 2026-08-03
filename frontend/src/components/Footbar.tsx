import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api/client';

const items = [
  { to: '/', label: 'Home', icon: 'HO', end: true },
  { to: '/members', label: 'Members', icon: 'ME' },
  { to: '/payments', label: 'Pay', icon: 'PY' },
  { to: '/alerts', label: 'Alerts', icon: 'AL', badge: true },
  { to: '/settings', label: 'More', icon: 'ST' },
];

export function Footbar() {
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api
      .listAlerts(7)
      .then((data) => setAlertCount(data.total))
      .catch(() => setAlertCount(0));
  }, []);

  return (
    <nav className="footbar" aria-label="Mobile navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `footbar-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon-wrap">
            <span className="nav-icon">{item.icon}</span>
            {item.badge && alertCount > 0 ? (
              <span className="foot-badge">{alertCount > 9 ? '9+' : alertCount}</span>
            ) : null}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
