import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  api,
  formatMoney,
  trainerCategoryLabel,
  type TrainerPackage,
  type TrainerPackageCategory,
} from '../api/client';
import { Modal } from '../components/Modal';

const CATEGORIES: TrainerPackageCategory[] = [
  'training_guidance',
  'group_training',
  'personal_training',
];

type FormState = {
  category: TrainerPackageCategory;
  name: string;
  duration_months: string;
  price: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  category: 'training_guidance',
  name: '',
  duration_months: '1',
  price: '',
  is_active: true,
};

export function TrainerPackagesPage() {
  const [packages, setPackages] = useState<TrainerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [editing, setEditing] = useState<TrainerPackage | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPackages(await api.listTrainerPackages());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load trainer packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const list = filter ? packages.filter((p) => p.category === filter) : packages;
    return CATEGORIES.map((category) => ({
      category,
      items: list.filter((p) => p.category === category),
    })).filter((group) => group.items.length > 0 || !filter);
  }, [packages, filter]);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setEditing(null);
    setCreating(true);
  }

  function openEdit(pkg: TrainerPackage) {
    setForm({
      category: pkg.category,
      name: pkg.name,
      duration_months: String(pkg.duration_months),
      price: String(Number(pkg.price)),
      is_active: pkg.is_active,
    });
    setFormError('');
    setCreating(false);
    setEditing(pkg);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const duration = Number(form.duration_months);
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isInteger(duration) || duration < 1 || Number.isNaN(price) || price < 0) {
      setFormError('Enter valid name, duration, and price');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        category: form.category,
        name: form.name.trim(),
        duration_months: duration,
        price,
        is_active: form.is_active,
      };
      if (editing) {
        await api.updateTrainerPackage(editing.id, payload);
      } else {
        await api.createTrainerPackage(payload);
      }
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save package');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(pkg: TrainerPackage) {
    try {
      const updated = await api.toggleTrainerPackage(pkg.id);
      setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update package');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trainer packages</h1>
          <p className="page-subtitle">Guidance, group, and personal training plans.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + New package
        </button>
      </div>

      <div className="chip-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className={`chip${!filter ? ' chip-active' : ''}`} onClick={() => setFilter('')}>
          All
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={`chip${filter === category ? ' chip-active' : ''}`}
            onClick={() => setFilter(category)}
          >
            {trainerCategoryLabel(category)}
          </button>
        ))}
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}

      {loading ? (
        <div className="card">Loading trainer packages…</div>
      ) : (
        <div className="category-stack">
          {grouped.map((group) => (
            <section key={group.category}>
              <h2 className="section-title">{trainerCategoryLabel(group.category)}</h2>
              {group.items.length === 0 ? (
                <p className="muted-line">No packages in this category.</p>
              ) : (
                <div className="package-grid">
                  {group.items.map((pkg) => (
                    <article key={pkg.id} className={`package-card${pkg.is_active ? '' : ' is-inactive'}`}>
                      <div className="package-card-top">
                        <h3 className="package-name">{pkg.name}</h3>
                        <span className={`badge ${pkg.is_active ? 'badge-active' : 'badge-muted'}`}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="package-price">{formatMoney(pkg.price)}</div>
                      <div className="package-meta">
                        {pkg.duration_months} {pkg.duration_months === 1 ? 'month' : 'months'}
                      </div>
                      <div className="package-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(pkg)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleToggle(pkg)}>
                          {pkg.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit ${editing.name}` : 'New trainer package'} onClose={() => { setCreating(false); setEditing(null); }}>
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <label htmlFor="tp-category">Category</label>
              <select
                id="tp-category"
                className="select-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TrainerPackageCategory })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {trainerCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-field">
              <label htmlFor="tp-name">Name</label>
              <input id="tp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="tp-duration">Duration (months)</label>
              <input id="tp-duration" type="number" min={1} value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="tp-price">Price (Rs)</label>
              <input id="tp-price" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Available for admissions
            </label>
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
