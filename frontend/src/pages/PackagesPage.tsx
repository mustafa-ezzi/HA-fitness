import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, formatMoney, type Package } from '../api/client';
import { Modal } from '../components/Modal';

const DURATION_PRESETS = [1, 3, 6, 12];

type FormState = {
  name: string;
  duration_months: string;
  price: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: '',
  duration_months: '1',
  price: '',
  is_active: true,
};

export function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState<Package | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Package | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPackages(await api.listPackages());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load packages');
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

  function openEdit(pkg: Package) {
    setForm({
      name: pkg.name,
      duration_months: String(pkg.duration_months),
      price: String(Number(pkg.price)),
      is_active: pkg.is_active,
    });
    setFormError('');
    setCreating(false);
    setEditing(pkg);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');

    const duration = Number(form.duration_months);
    const price = Number(form.price);

    if (!form.name.trim()) {
      setFormError('Package name is required');
      return;
    }
    if (!Number.isInteger(duration) || duration < 1) {
      setFormError('Duration must be a whole number of months');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setFormError('Price must be zero or more');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        duration_months: duration,
        price,
        is_active: form.is_active,
      };

      if (editing) {
        await api.updatePackage(editing.id, payload);
        setNotice(`${payload.name} updated`);
      } else {
        await api.createPackage(payload);
        setNotice(`${payload.name} created`);
      }

      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save package');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(pkg: Package) {
    setError('');
    try {
      const updated = await api.togglePackage(pkg.id);
      setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setNotice(`${updated.name} is now ${updated.is_active ? 'active' : 'inactive'}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update package');
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setError('');
    try {
      await api.deletePackage(pendingDelete.id);
      setNotice(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete package');
      setPendingDelete(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Packages</h1>
          <p className="page-subtitle">Membership plans and their prices.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + New package
        </button>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}
      {notice ? (
        <p className="banner banner-success" onAnimationEnd={() => setNotice('')}>
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div className="card">Loading packages…</div>
      ) : packages.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No packages yet. Create your first plan to start admitting members.
          </p>
        </div>
      ) : (
        <div className="package-grid">
          {packages.map((pkg) => (
            <article key={pkg.id} className={`package-card${pkg.is_active ? '' : ' is-inactive'}`}>
              <div className="package-card-top">
                <h2 className="package-name">{pkg.name}</h2>
                <span className={`badge ${pkg.is_active ? 'badge-active' : 'badge-muted'}`}>
                  {pkg.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="package-price">{formatMoney(pkg.price)}</div>
              <div className="package-meta">
                {pkg.duration_months} {pkg.duration_months === 1 ? 'month' : 'months'} membership
              </div>

              <div className="package-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(pkg)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => void handleToggle(pkg)}
                >
                  {pkg.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setPendingDelete(pkg)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit ${editing.name}` : 'New package'} onClose={closeForm}>
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <label htmlFor="pkg-name">Package name</label>
              <input
                id="pkg-name"
                value={form.name}
                placeholder="e.g. 3 Months"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="input-field">
              <label htmlFor="pkg-duration">Duration (months)</label>
              <input
                id="pkg-duration"
                type="number"
                min={1}
                max={120}
                value={form.duration_months}
                onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
                required
              />
              <div className="chip-row">
                {DURATION_PRESETS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    className={`chip${Number(form.duration_months) === months ? ' chip-active' : ''}`}
                    onClick={() => setForm({ ...form, duration_months: String(months) })}
                  >
                    {months}M
                  </button>
                ))}
              </div>
            </div>

            <div className="input-field">
              <label htmlFor="pkg-price">Price (Rs)</label>
              <input
                id="pkg-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                placeholder="0"
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Available for new admissions
            </label>

            {formError ? <p className="error-text">{formError}</p> : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create package'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <Modal title="Delete package" onClose={() => setPendingDelete(null)}>
          <p style={{ color: 'var(--text-muted)' }}>
            Delete <strong style={{ color: 'var(--text)' }}>{pendingDelete.name}</strong>? This
            cannot be undone. Deactivate it instead if you may use it later.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void handleDelete()}>
              Delete
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
