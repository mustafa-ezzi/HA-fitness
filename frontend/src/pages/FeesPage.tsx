import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, formatMoney, type FeeItem } from '../api/client';
import { Modal } from '../components/Modal';

type FormState = {
  name: string;
  price: string;
  unit: string;
  notes: string;
};

const emptyForm: FormState = { name: '', price: '', unit: 'fixed', notes: '' };

export function FeesPage() {
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FeeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFees(await api.listFees());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load fee table');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setEditing(null);
    setCreating(true);
  }

  function openEdit(fee: FeeItem) {
    setForm({
      name: fee.name,
      price: String(Number(fee.price)),
      unit: fee.unit,
      notes: fee.notes ?? '',
    });
    setFormError('');
    setCreating(false);
    setEditing(fee);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price < 0) {
      setFormError('Enter a valid name and price');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        price,
        unit: form.unit.trim() || 'fixed',
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api.updateFee(editing.id, payload);
      } else {
        await api.createFee(payload);
      }
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee table</h1>
          <p className="page-subtitle">
            Rate card for the gym. These can be selected as add-ons when admitting or renewing a
            member. Per-month fees are multiplied by the membership duration.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Add fee
        </button>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}

      {loading ? (
        <div className="card">Loading fee table…</div>
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>Fee</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <td>
                    <strong>{fee.name}</strong>
                  </td>
                  <td>{formatMoney(fee.price)}</td>
                  <td>{fee.unit}</td>
                  <td className="muted-line" style={{ margin: 0 }}>
                    {fee.notes || '—'}
                  </td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(fee)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit ${editing.name}` : 'Add fee'} onClose={() => { setCreating(false); setEditing(null); }}>
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <label htmlFor="fee-name">Name</label>
              <input id="fee-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="fee-price">Price (Rs)</label>
              <input id="fee-price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="fee-unit">Unit</label>
              <input id="fee-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="per month / per day / one-time" />
            </div>
            <div className="input-field">
              <label htmlFor="fee-notes">Notes</label>
              <input id="fee-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {formError ? <p className="error-text">{formError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
