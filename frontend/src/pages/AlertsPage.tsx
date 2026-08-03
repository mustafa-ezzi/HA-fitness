import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  api,
  formatDate,
  paymentLabel,
  type AlertItem,
  type Member,
} from '../api/client';
import { RenewMemberModal } from '../components/RenewMemberModal';

function daysLabel(alert: AlertItem): string {
  if (alert.days_left < 0) {
    const n = Math.abs(alert.days_left);
    return `${n} day${n === 1 ? '' : 's'} overdue`;
  }
  if (alert.days_left === 0) return 'Ends today';
  return `${alert.days_left} day${alert.days_left === 1 ? '' : 's'} left`;
}

function AlertCard({
  alert,
  onRenew,
}: {
  alert: AlertItem;
  onRenew: (memberId: number) => void;
}) {
  const isExpired = alert.alert_type.includes('expired') && !alert.alert_type.includes('expiring');
  return (
    <article className={`alert-card${isExpired ? ' alert-card-expired' : ''}`}>
      <div className="alert-card-top">
        <div>
          <Link to={`/members/${alert.member_id}`} className="table-link">
            {alert.member_name}
          </Link>
          <div className="muted-line">{alert.contact}</div>
        </div>
        <span className={`badge ${isExpired ? 'badge-status-expired' : 'badge-pay-partial'}`}>
          {isExpired ? 'Expired' : 'Expiring soon'}
        </span>
      </div>
      <div className="alert-card-body">
        <div>
          <span className="summary-label">{alert.scope === 'trainer' ? 'Trainer plan' : 'Gym plan'}</span>
          <strong>{alert.package_name}</strong>
        </div>
        <div>
          <span className="summary-label">End date</span>
          <strong>{formatDate(alert.end_date)}</strong>
        </div>
        <div>
          <span className="summary-label">Timing</span>
          <strong>{daysLabel(alert)}</strong>
        </div>
        <div>
          <span className="summary-label">Payment</span>
          <strong>{paymentLabel(alert.payment_status)}</strong>
        </div>
      </div>
      {alert.scope === 'gym' ? (
        <div className="package-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRenew(alert.member_id)}>
            Renew
          </button>
          <Link to={`/members/${alert.member_id}`} className="btn btn-outline btn-sm">
            View
          </Link>
        </div>
      ) : (
        <div className="package-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRenew(alert.member_id)}>
            Renew / change
          </button>
          <Link to={`/members/${alert.member_id}`} className="btn btn-outline btn-sm">
            View
          </Link>
        </div>
      )}
    </article>
  );
}

export function AlertsPage() {
  const [expired, setExpired] = useState<AlertItem[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [renewMember, setRenewMember] = useState<Member | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAlerts(7);
      setExpired(data.expired);
      setExpiringSoon(data.expiring_soon);
      if (data.synced > 0) {
        setNotice(`Marked ${data.synced} member(s) as expired`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openRenew(memberId: number) {
    try {
      setRenewMember(await api.getMember(memberId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open renewal');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Expired and soon-to-expire gym & trainer packages.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}
      {notice ? (
        <p className="banner banner-success" onAnimationEnd={() => setNotice('')}>
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="card">Checking memberships…</div>
      ) : (
        <div className="category-stack">
          <section>
            <h2 className="section-title">
              Expired ({expired.length})
            </h2>
            {expired.length === 0 ? (
              <div className="card">
                <p className="muted-line" style={{ margin: 0 }}>
                  No expired packages right now.
                </p>
              </div>
            ) : (
              <div className="alert-grid">
                {expired.map((alert) => (
                  <AlertCard
                    key={`${alert.scope}-${alert.member_id}-${alert.end_date}`}
                    alert={alert}
                    onRenew={openRenew}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="section-title">
              Expiring in 7 days ({expiringSoon.length})
            </h2>
            {expiringSoon.length === 0 ? (
              <div className="card">
                <p className="muted-line" style={{ margin: 0 }}>
                  Nothing ending this week.
                </p>
              </div>
            ) : (
              <div className="alert-grid">
                {expiringSoon.map((alert) => (
                  <AlertCard
                    key={`${alert.scope}-${alert.member_id}-${alert.end_date}`}
                    alert={alert}
                    onRenew={openRenew}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {renewMember ? (
        <RenewMemberModal
          member={renewMember}
          onClose={() => setRenewMember(null)}
          onRenewed={(updated) => {
            setRenewMember(null);
            setNotice(`${updated.full_name} renewed until ${formatDate(updated.end_date)}`);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
