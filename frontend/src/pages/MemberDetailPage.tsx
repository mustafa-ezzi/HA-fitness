import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  api,
  formatDate,
  formatDateTime,
  formatMoney,
  memberStatusLabel,
  paymentLabel,
  type Member,
  type Payment,
  type PaymentKind,
} from '../api/client';
import { Modal } from '../components/Modal';
import { RenewMemberModal } from '../components/RenewMemberModal';
import { formatCnic, validateCnic, validateContact } from '../utils/validation';

type EditForm = {
  full_name: string;
  contact: string;
  cnic: string;
  email: string;
  address: string;
  status: Member['status'];
};

type PayForm = {
  kind: PaymentKind;
  amount: string;
  note: string;
};

export function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const memberId = Number(id);

  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState<PayForm>({ kind: 'gym', amount: '', note: '' });
  const [payError, setPayError] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingPaymentDelete, setPendingPaymentDelete] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(memberId) || memberId < 1) {
      setError('Invalid member');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [memberData, paymentData] = await Promise.all([
        api.getMember(memberId),
        api.listMemberPayments(memberId),
      ]);
      setMember(memberData);
      setPayments(paymentData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load member');
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit() {
    if (!member) return;
    setForm({
      full_name: member.full_name,
      contact: member.contact,
      cnic: member.cnic,
      email: member.email ?? '',
      address: member.address,
      status: member.status,
    });
    setFormError('');
    setEditing(true);
  }

  function openPay(kind: PaymentKind = 'gym') {
    if (!member) return;
    const remainingGym = Math.max(0, Number(member.amount_due) - Number(member.amount_paid));
    const remainingTrainer = member.trainer_package
      ? Math.max(0, Number(member.trainer_amount_due ?? 0) - Number(member.trainer_amount_paid ?? 0))
      : 0;
    const defaultAmount = kind === 'trainer' ? remainingTrainer : remainingGym;
    setPayForm({
      kind,
      amount: defaultAmount > 0 ? String(defaultAmount) : '',
      note: '',
    });
    setPayError('');
    setPaying(true);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form || !member) return;
    setFormError('');
    const contactError = validateContact(form.contact);
    if (contactError) {
      setFormError(contactError);
      return;
    }
    const cnicError = validateCnic(form.cnic);
    if (cnicError) {
      setFormError(cnicError);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMember(member.id, {
        full_name: form.full_name.trim(),
        contact: form.contact.trim(),
        cnic: form.cnic.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        status: form.status,
      });
      setMember(updated);
      setEditing(false);
      setNotice('Member details updated');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not update member');
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!member) return;
    const amount = Number(payForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      setPayError('Enter an amount greater than zero');
      return;
    }
    setPaySaving(true);
    setPayError('');
    try {
      await api.createMemberPayment(member.id, {
        amount,
        kind: payForm.kind,
        note: payForm.note.trim() || null,
      });
      setPaying(false);
      setNotice(`${payForm.kind === 'trainer' ? 'Trainer' : 'Gym'} payment recorded`);
      await load();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Could not record payment');
    } finally {
      setPaySaving(false);
    }
  }

  async function handleDelete() {
    if (!member) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteMember(member.id);
      navigate('/members', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete member');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeletePayment() {
    if (!pendingPaymentDelete) return;
    setDeletingPayment(true);
    setError('');
    try {
      await api.deletePayment(pendingPaymentDelete.id);
      setNotice('Payment deleted. Balance updated.');
      setPendingPaymentDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete payment');
    } finally {
      setDeletingPayment(false);
    }
  }

  if (loading) {
    return <div className="card">Loading member…</div>;
  }

  if (error || !member) {
    return (
      <div>
        <p className="banner banner-error">{error || 'Member not found'}</p>
        <Link to="/members" className="btn btn-outline">
          Back to members
        </Link>
      </div>
    );
  }

  const remaining = Math.max(0, Number(member.amount_due) - Number(member.amount_paid));
  const trainerRemaining = member.trainer_package
    ? Math.max(0, Number(member.trainer_amount_due ?? 0) - Number(member.trainer_amount_paid ?? 0))
    : 0;
  const canPayGym = remaining > 0;
  const canPayTrainer = Boolean(member.trainer_package) && trainerRemaining > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{member.full_name}</h1>
          <p className="page-subtitle">
            {member.package.name} · Ends {formatDate(member.end_date)}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/members" className="btn btn-outline">
            Back
          </Link>
          {member.status !== 'inactive' ? (
            <button type="button" className="btn btn-primary" onClick={() => setRenewing(true)}>
              Renew
            </button>
          ) : null}
          {(canPayGym || canPayTrainer) && (
            <button type="button" className="btn btn-outline" onClick={() => openPay(canPayGym ? 'gym' : 'trainer')}>
              + Add payment
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={openEdit}>
            Edit profile
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      {notice ? (
        <p className="banner banner-success" onAnimationEnd={() => setNotice('')}>
          {notice}
        </p>
      ) : null}

      <div className="detail-grid">
        <section className="card">
          <h2 className="section-title">Membership</h2>
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`badge badge-status-${member.status}`}>
                  {memberStatusLabel(member.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{member.package.name}</dd>
            </div>
            <div>
              <dt>Start</dt>
              <dd>{formatDate(member.start_date)}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{formatDate(member.end_date)}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <div className="section-header-row">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              Gym payment
            </h2>
            {canPayGym ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openPay('gym')}>
                Pay
              </button>
            ) : null}
          </div>
          <dl className="detail-list" style={{ marginTop: '0.85rem' }}>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`badge badge-pay-${member.payment_status}`}>
                  {paymentLabel(member.payment_status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Amount due</dt>
              <dd>{formatMoney(member.amount_due)}</dd>
            </div>
            <div>
              <dt>Amount paid</dt>
              <dd>{formatMoney(member.amount_paid)}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{formatMoney(remaining)}</dd>
            </div>
          </dl>
        </section>

        <section className="card form-span-2">
          <div className="section-header-row">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              Trainer package
            </h2>
            {canPayTrainer ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openPay('trainer')}>
                Pay
              </button>
            ) : null}
          </div>
          {member.trainer_package ? (
            <dl className="detail-list" style={{ marginTop: '0.85rem' }}>
              <div>
                <dt>Plan</dt>
                <dd>{member.trainer_package.name}</dd>
              </div>
              <div>
                <dt>Trainer</dt>
                <dd>{member.trainer?.full_name || 'Unassigned'}</dd>
              </div>
              <div>
                <dt>Period</dt>
                <dd>
                  {member.trainer_start_date ? formatDate(member.trainer_start_date) : '—'}
                  {' → '}
                  {member.trainer_end_date ? formatDate(member.trainer_end_date) : '—'}
                </dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  <span className={`badge badge-pay-${member.trainer_payment_status ?? 'unpaid'}`}>
                    {paymentLabel(member.trainer_payment_status)}
                  </span>
                  {' · '}
                  {formatMoney(member.trainer_amount_paid ?? 0)} /{' '}
                  {formatMoney(member.trainer_amount_due ?? 0)}
                  {trainerRemaining > 0 ? ` · remaining ${formatMoney(trainerRemaining)}` : ''}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted-line" style={{ margin: '0.85rem 0 0' }}>
              No trainer package on this admission.
            </p>
          )}
        </section>

        <section className="card form-span-2">
          <h2 className="section-title">Payment history</h2>
          {payments.length === 0 ? (
            <p className="muted-line" style={{ margin: 0 }}>
              No payments recorded yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
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
                          onClick={() => setPendingPaymentDelete(payment)}
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
        </section>

        <section className="card form-span-2">
          <h2 className="section-title">Contact</h2>
          <dl className="detail-list">
            <div>
              <dt>Phone</dt>
              <dd>{member.contact}</dd>
            </div>
            <div>
              <dt>CNIC</dt>
              <dd>{member.cnic}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{member.email || '—'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{member.address}</dd>
            </div>
          </dl>
        </section>
      </div>

      {editing && form ? (
        <Modal title="Edit member" onClose={() => setEditing(false)}>
          <form className="modal-form" onSubmit={handleSave}>
            <div className="input-field">
              <label htmlFor="edit-name">Full name</label>
              <input
                id="edit-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="edit-contact">Contact</label>
              <input
                id="edit-contact"
                inputMode="tel"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="edit-cnic">CNIC</label>
              <input
                id="edit-cnic"
                inputMode="numeric"
                maxLength={15}
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: formatCnic(e.target.value) })}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="edit-email">Email</label>
              <input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="input-field">
              <label htmlFor="edit-address">Address</label>
              <input
                id="edit-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                className="select-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Member['status'] })}
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {paying ? (
        <Modal title="Add payment" onClose={() => setPaying(false)}>
          <form className="modal-form" onSubmit={handlePay}>
            <div className="input-field">
              <label htmlFor="pay-kind">Payment for</label>
              <select
                id="pay-kind"
                className="select-input"
                value={payForm.kind}
                onChange={(e) => {
                  const kind = e.target.value as PaymentKind;
                  const amount =
                    kind === 'trainer'
                      ? trainerRemaining > 0
                        ? String(trainerRemaining)
                        : ''
                      : remaining > 0
                        ? String(remaining)
                        : '';
                  setPayForm({ ...payForm, kind, amount });
                }}
              >
                <option value="gym" disabled={!canPayGym && remaining <= 0}>
                  Gym membership {remaining > 0 ? `(remaining ${formatMoney(remaining)})` : '(paid)'}
                </option>
                {member.trainer_package ? (
                  <option value="trainer" disabled={!canPayTrainer && trainerRemaining <= 0}>
                    Trainer package{' '}
                    {trainerRemaining > 0
                      ? `(remaining ${formatMoney(trainerRemaining)})`
                      : '(paid)'}
                  </option>
                ) : null}
              </select>
            </div>
            <div className="input-field">
              <label htmlFor="pay-amount">Amount (Rs)</label>
              <input
                id="pay-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="pay-note">Note (optional)</label>
              <input
                id="pay-note"
                value={payForm.note}
                onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                placeholder="Cash / JazzCash / remaining balance"
              />
            </div>
            {payError ? <p className="error-text">{payError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setPaying(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={paySaving}>
                {paySaving ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {renewing ? (
        <RenewMemberModal
          member={member}
          onClose={() => setRenewing(false)}
          onRenewed={(updated) => {
            setMember(updated);
            setRenewing(false);
            setNotice(`${updated.full_name} renewed until ${formatDate(updated.end_date)}`);
            void load();
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete member" onClose={() => setConfirmDelete(false)}>
          <p style={{ color: 'var(--text-muted)' }}>
            Delete <strong style={{ color: 'var(--text)' }}>{member.full_name}</strong>? This removes
            their payments and renewals too. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>
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

      {pendingPaymentDelete ? (
        <Modal
          title="Delete payment"
          onClose={() => !deletingPayment && setPendingPaymentDelete(null)}
        >
          <p className="muted-line">
            Delete {formatMoney(pendingPaymentDelete.amount)} ({pendingPaymentDelete.kind}) payment?
            This reduces the member’s paid balance. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={deletingPayment}
              onClick={() => setPendingPaymentDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deletingPayment}
              onClick={() => void handleDeletePayment()}
            >
              {deletingPayment ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
