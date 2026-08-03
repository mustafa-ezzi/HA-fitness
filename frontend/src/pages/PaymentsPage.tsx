import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ApiError,
  api,
  formatDateTime,
  formatMoney,
  type PaymentKind,
  type PaymentWithMember,
} from '../api/client';
import { Modal } from '../components/Modal';

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState<'' | PaymentKind>('');
  const [pendingDelete, setPendingDelete] = useState<PaymentWithMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayments(
        await api.listPayments({
          limit: 100,
          kind: kind || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load payments');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await api.deletePayment(pendingDelete.id);
      setNotice('Payment deleted. Member balance updated.');
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete payment');
    } finally {
      setDeleting(false);
    }
  }

  const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Recent gym and trainer payment activity.</p>
        </div>
      </div>

      <div className="card filters-card">
        <div className="filters-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="input-field">
            <label htmlFor="pay-filter">Type</label>
            <select
              id="pay-filter"
              className="select-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as '' | PaymentKind)}
            >
              <option value="">All payments</option>
              <option value="gym">Gym only</option>
              <option value="trainer">Trainer only</option>
            </select>
          </div>
          <div className="admit-summary" style={{ margin: 0, alignSelf: 'end' }}>
            <div>
              <span className="summary-label">Shown total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>
        </div>
      </div>

      {notice ? <p className="banner banner-success">{notice}</p> : null}
      {error ? <p className="banner banner-error">{error}</p> : null}

      {loading ? (
        <div className="card">Loading payments…</div>
      ) : payments.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No payments yet. Record payments from a member’s detail page.
          </p>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Member</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Note</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateTime(payment.paid_at)}</td>
                  <td>
                    <Link to={`/members/${payment.member_id}`} className="table-link">
                      {payment.member_name}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${payment.kind === 'trainer' ? 'badge-active' : 'badge-muted'}`}>
                      {payment.kind === 'trainer' ? 'Trainer' : 'Gym'}
                    </span>
                  </td>
                  <td>{formatMoney(payment.amount)}</td>
                  <td>{payment.note || '—'}</td>
                  <td>{payment.recorded_by}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setNotice('');
                        setPendingDelete(payment);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete ? (
        <Modal title="Delete payment" onClose={() => !deleting && setPendingDelete(null)}>
          <p className="muted-line">
            Delete {formatMoney(pendingDelete.amount)} ({pendingDelete.kind}) for{' '}
            <strong style={{ color: 'var(--text)' }}>{pendingDelete.member_name}</strong>? This
            reduces their paid balance. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
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
