import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/auth-context';

type SystemStatus = {
  api: 'checking' | 'online' | 'offline';
  members: number | null;
  packages: number | null;
  trainers: number | null;
};

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<SystemStatus>({
    api: 'checking',
    members: null,
    packages: null,
    trainers: null,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.health(),
      api.listMembers(),
      api.listPackages(),
      api.listTrainers(),
    ])
      .then(([, members, packages, trainers]) => {
        if (!cancelled) {
          setStatus({
            api: 'online',
            members: members.length,
            packages: packages.length,
            trainers: trainers.length,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus((current) => ({ ...current, api: 'offline' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Account and system status.</p>

      <div className="detail-grid">
        <section className="card">
          <h2 className="section-title">Admin account</h2>
          <dl className="detail-list">
            <div>
              <dt>Username</dt>
              <dd>{user?.username ?? '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role ?? '—'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="badge badge-active">Active</span>
              </dd>
            </div>
          </dl>
          <button type="button" className="btn btn-outline settings-logout" onClick={() => void logout()}>
            Log out
          </button>
        </section>

        <section className="card">
          <h2 className="section-title">System status</h2>
          <dl className="detail-list">
            <div>
              <dt>API</dt>
              <dd>
                <span
                  className={`badge ${
                    status.api === 'online'
                      ? 'badge-pay-paid'
                      : status.api === 'offline'
                        ? 'badge-pay-unpaid'
                        : 'badge-muted'
                  }`}
                >
                  {status.api}
                </span>
              </dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{status.members ?? '—'}</dd>
            </div>
            <div>
              <dt>Gym plans</dt>
              <dd>{status.packages ?? '—'}</dd>
            </div>
            <div>
              <dt>Trainers</dt>
              <dd>{status.trainers ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
