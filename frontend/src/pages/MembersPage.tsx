import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  api,
  formatDate,
  formatMoney,
  memberStatusLabel,
  paymentLabel,
  type Member,
} from '../api/client';
import { Modal } from '../components/Modal';

function csvCell(value: string | number): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMembers(
        await api.listMembers({
          q: q.trim() || undefined,
          status: status || undefined,
          payment_status: paymentStatus || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load members');
    } finally {
      setLoading(false);
    }
  }, [q, status, paymentStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteMember(pendingDelete.id);
      setNotice(`${pendingDelete.full_name} deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete member');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = [
      'Full name',
      'Contact',
      'CNIC',
      'Email',
      'Address',
      'Package',
      'Start date',
      'End date',
      'Amount due',
      'Amount paid',
      'Payment status',
      'Member status',
    ];
    const rows = members.map((member) => [
      member.full_name,
      member.contact,
      member.cnic,
      member.email ?? '',
      member.address,
      member.package.name,
      member.start_date,
      member.end_date,
      member.amount_due,
      member.amount_paid,
      member.payment_status,
      member.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ha-fitness-members-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">Search admissions and check payment status.</p>
        </div>
        <div className="header-actions no-print">
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={members.length === 0}>
            Export CSV
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()} disabled={members.length === 0}>
            Print
          </button>
          <Link to="/members/new" className="btn btn-primary">
            + New admission
          </Link>
        </div>
      </div>

      <div className="card filters-card no-print">
        <div className="filters-row">
          <div className="input-field">
            <label htmlFor="member-search">Search</label>
            <input
              id="member-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, contact, or CNIC"
            />
          </div>
          <div className="input-field">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              className="select-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="input-field">
            <label htmlFor="payment-filter">Payment</label>
            <select
              id="payment-filter"
              className="select-input"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}
      {notice ? (
        <p className="banner banner-success" onAnimationEnd={() => setNotice('')}>
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="card">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="card empty-state">
          <strong>No members found</strong>
          <span>Try clearing the filters or admit a new member.</span>
          <Link to="/members/new" className="btn btn-primary btn-sm no-print">+ New admission</Link>
        </div>
      ) : (
        <>
          <div className="table-wrap card desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Package</th>
                  <th>Ends</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link to={`/members/${member.id}`} className="table-link">
                        {member.full_name}
                      </Link>
                      <div className="muted-line">{member.cnic}</div>
                    </td>
                    <td>{member.contact}</td>
                    <td>{member.package.name}</td>
                    <td>{formatDate(member.end_date)}</td>
                    <td>
                      <span className={`badge badge-pay-${member.payment_status}`}>
                        {paymentLabel(member.payment_status)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-status-${member.status}`}>
                        {memberStatusLabel(member.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setPendingDelete(member)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="member-cards mobile-only">
            {members.map((member) => (
              <div key={member.id} className="member-card">
                <Link to={`/members/${member.id}`} className="member-card-link">
                  <div className="member-card-top">
                    <strong>{member.full_name}</strong>
                    <span className={`badge badge-status-${member.status}`}>
                      {memberStatusLabel(member.status)}
                    </span>
                  </div>
                  <div className="muted-line">{member.contact} · {member.package.name}</div>
                  <div className="member-card-meta">
                    <span>Ends {formatDate(member.end_date)}</span>
                    <span className={`badge badge-pay-${member.payment_status}`}>
                      {paymentLabel(member.payment_status)}
                    </span>
                  </div>
                  <div className="muted-line">
                    {formatMoney(member.amount_paid)} / {formatMoney(member.amount_due)}
                  </div>
                </Link>
                <div className="package-actions">
                  <Link to={`/members/${member.id}`} className="btn btn-outline btn-sm">
                    View
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setPendingDelete(member)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pendingDelete ? (
        <Modal title="Delete member" onClose={() => setPendingDelete(null)}>
          <p style={{ color: 'var(--text-muted)' }}>
            Delete <strong style={{ color: 'var(--text)' }}>{pendingDelete.full_name}</strong>? This
            removes their payments and renewals too. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
