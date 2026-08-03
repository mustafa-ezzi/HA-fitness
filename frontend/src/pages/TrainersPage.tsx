import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api, type Trainer } from '../api/client';
import { Modal } from '../components/Modal';

type FormState = {
  full_name: string;
  contact: string;
  specialty: string;
  is_active: boolean;
};

const emptyForm: FormState = { full_name: '', contact: '', specialty: '', is_active: true };

export function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTrainers(await api.listTrainers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load trainers');
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

  function openEdit(trainer: Trainer) {
    setForm({
      full_name: trainer.full_name,
      contact: trainer.contact,
      specialty: trainer.specialty ?? '',
      is_active: trainer.is_active,
    });
    setFormError('');
    setCreating(false);
    setEditing(trainer);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.contact.trim()) {
      setFormError('Name and contact are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        full_name: form.full_name.trim(),
        contact: form.contact.trim(),
        specialty: form.specialty.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        await api.updateTrainer(editing.id, payload);
      } else {
        await api.createTrainer(payload);
      }
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save trainer');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(trainer: Trainer) {
    try {
      const updated = await api.toggleTrainer(trainer.id);
      setTrainers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update trainer');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trainers</h1>
          <p className="page-subtitle">Staff who can be assigned with trainer packages.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Add trainer
        </button>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}

      {loading ? (
        <div className="card">Loading trainers…</div>
      ) : trainers.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No trainers yet. Add your coaching staff here.</p>
        </div>
      ) : (
        <div className="package-grid">
          {trainers.map((trainer) => (
            <article key={trainer.id} className={`package-card${trainer.is_active ? '' : ' is-inactive'}`}>
              <div className="package-card-top">
                <h2 className="package-name">{trainer.full_name}</h2>
                <span className={`badge ${trainer.is_active ? 'badge-active' : 'badge-muted'}`}>
                  {trainer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="package-meta">{trainer.contact}</div>
              <div className="package-meta">{trainer.specialty || 'General training'}</div>
              <div className="package-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(trainer)}>
                  Edit
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleToggle(trainer)}>
                  {trainer.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating || editing ? (
        <Modal title={editing ? `Edit ${editing.full_name}` : 'Add trainer'} onClose={() => { setCreating(false); setEditing(null); }}>
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <label htmlFor="tr-name">Full name</label>
              <input id="tr-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="tr-contact">Contact</label>
              <input id="tr-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
            </div>
            <div className="input-field">
              <label htmlFor="tr-specialty">Specialty</label>
              <input id="tr-specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Personal training" />
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
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
