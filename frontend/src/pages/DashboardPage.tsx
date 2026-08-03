import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatMoney, paymentLabel, type Member } from '../api/client';
import { useAuth } from '../context/auth-context';

export function DashboardPage() {
  const { user } = useAuth();
  const [activeMembers, setActiveMembers] = useState<number | null>(null);
  const [duePayments, setDuePayments] = useState<number | null>(null);
  const [expired, setExpired] = useState<number | null>(null);
  const [expiringSoon, setExpiringSoon] = useState<number | null>(null);
  const [todayAdmissions, setTodayAdmissions] = useState<number | null>(null);
  const [recentMembers, setRecentMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    Promise.all([api.listMembers(), api.listAlerts(7)])
      .then(([members, alerts]) => {
        if (cancelled) return;
        setActiveMembers(members.filter((m) => m.status === 'active').length);
        setDuePayments(
          members.filter((m) => m.payment_status === 'unpaid' || m.payment_status === 'partial')
            .length,
        );
        setExpired(alerts.expired.filter((a) => a.scope === 'gym').length);
        setExpiringSoon(alerts.expiring_soon.filter((a) => a.scope === 'gym').length);
        setTodayAdmissions(members.filter((m) => m.created_at.slice(0, 10) === today).length);
        setRecentMembers(members.slice(0, 5));
      })
      .catch(() => {
        if (cancelled) return;
        setActiveMembers(null);
        setDuePayments(null);
        setExpired(null);
        setExpiringSoon(null);
        setTodayAdmissions(null);
        setError('Dashboard data could not be loaded. Try refreshing the page.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Welcome back, {user?.username}.</p>

      {error ? <p className="banner banner-error">{error}</p> : null}

      <div className="stats-grid">
        <Link to="/members" className="stat-card">
          <span className="stat-label">Active members</span>
          <strong className="stat-value">{activeMembers ?? '—'}</strong>
          <span className="stat-hint">View membership list →</span>
        </Link>
        <Link to="/members" className="stat-card stat-card-warning">
          <span className="stat-label">Unpaid / partial</span>
          <strong className="stat-value">{duePayments ?? '—'}</strong>
          <span className="stat-hint">Review balances →</span>
        </Link>
        <Link to="/alerts" className="stat-card stat-card-soon">
          <span className="stat-label">Expiring in 7 days</span>
          <strong className="stat-value">{expiringSoon ?? '—'}</strong>
          <span className="stat-hint">Open alerts →</span>
        </Link>
        <Link to="/alerts" className="stat-card stat-card-danger">
          <span className="stat-label">Expired</span>
          <strong className="stat-value">{expired ?? '—'}</strong>
          <span className="stat-hint">Renew members →</span>
        </Link>
        <Link to="/members" className="stat-card">
          <span className="stat-label">Today’s admissions</span>
          <strong className="stat-value">{todayAdmissions ?? '—'}</strong>
          <span className="stat-hint">View new members →</span>
        </Link>
      </div>

      <section className="card dashboard-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Recent admissions</h2>
            <p className="muted-line">The latest five registered members.</p>
          </div>
          <Link to="/members/new" className="btn btn-primary btn-sm">+ New admission</Link>
        </div>

        {recentMembers.length === 0 ? (
          <div className="empty-state">
            <strong>No admissions yet</strong>
            <span>Add the first member to see activity here.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Package</th>
                  <th>Paid</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {recentMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link to={`/members/${member.id}`} className="table-link">
                        {member.full_name}
                      </Link>
                      <div className="muted-line">{member.contact}</div>
                    </td>
                    <td>{member.package.name}</td>
                    <td>
                      <span className={`badge badge-pay-${member.payment_status}`}>
                        {paymentLabel(member.payment_status)}
                      </span>
                      <div className="muted-line">{formatMoney(member.amount_paid)}</div>
                    </td>
                    <td>{formatDate(member.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
