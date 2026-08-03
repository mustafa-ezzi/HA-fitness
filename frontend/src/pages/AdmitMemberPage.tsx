import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  api,
  formatMoney,
  type FeeItem,
  type Package,
  type Trainer,
  type TrainerPackage,
} from '../api/client';
import { feeAddonLineAmount, selectedAddonLines, selectedAddonTotal } from '../utils/fees';
import { formatCnic, validateCnic, validateContact } from '../utils/validation';

type FormState = {
  full_name: string;
  contact: string;
  cnic: string;
  email: string;
  address: string;
  package_id: string;
  amount_paid: string;
  start_date: string;
  trainer_package_id: string;
  trainer_id: string;
  trainer_amount_paid: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsISO(startISO: string, months: number): string {
  const [y, m, d] = startISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const monthIndex = start.getMonth() + months;
  const year = start.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(start.getDate(), lastDay);
  const end = new Date(year, month, day);
  const yy = end.getFullYear();
  const mm = String(end.getMonth() + 1).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function paymentPreview(paid: number, due: number): string {
  if (Number.isNaN(paid)) return '—';
  if (paid <= 0) return 'Unpaid';
  if (paid < due) return 'Partial';
  return 'Paid';
}

export function AdmitMemberPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [trainerPackages, setTrainerPackages] = useState<TrainerPackage[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addonIds, setAddonIds] = useState<number[]>([]);
  const [form, setForm] = useState<FormState>({
    full_name: '',
    contact: '',
    cnic: '',
    email: '',
    address: '',
    package_id: '',
    amount_paid: '0',
    start_date: todayISO(),
    trainer_package_id: '',
    trainer_id: '',
    trainer_amount_paid: '0',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingPackages(true);
      try {
        const [gymPlans, feeItems, trainingPlans, staff] = await Promise.all([
          api.listPackages(true),
          api.listFees(true),
          api.listTrainerPackages({ activeOnly: true }),
          api.listTrainers(true),
        ]);
        if (cancelled) return;
        setPackages(gymPlans);
        setFees(feeItems);
        setTrainerPackages(trainingPlans);
        setTrainers(staff);
        if (gymPlans.length > 0) {
          setForm((prev) => ({
            ...prev,
            package_id: prev.package_id || String(gymPlans[0].id),
            amount_paid:
              prev.amount_paid === '0' ? String(Number(gymPlans[0].price)) : prev.amount_paid,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load admission options');
        }
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPackage = useMemo(
    () => packages.find((p) => String(p.id) === form.package_id) ?? null,
    [packages, form.package_id],
  );

  const selectedTrainerPackage = useMemo(
    () => trainerPackages.find((p) => String(p.id) === form.trainer_package_id) ?? null,
    [trainerPackages, form.trainer_package_id],
  );

  const durationMonths = selectedPackage?.duration_months ?? 1;
  const packagePrice = selectedPackage ? Number(selectedPackage.price) : 0;
  const addonLines = selectedAddonLines(fees, addonIds, durationMonths);
  const addonsTotal = selectedAddonTotal(fees, addonIds, durationMonths);
  const amountDue = packagePrice + addonsTotal;
  const amountPaid = Number(form.amount_paid);
  const trainerDue = selectedTrainerPackage ? Number(selectedTrainerPackage.price) : 0;
  const trainerPaid = Number(form.trainer_amount_paid);

  function syncPaidToDue(nextDue: number, prev: FormState): FormState {
    return { ...prev, amount_paid: String(nextDue) };
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'package_id') {
        const pkg = packages.find((p) => String(p.id) === value);
        if (pkg) {
          const due =
            Number(pkg.price) + selectedAddonTotal(fees, addonIds, pkg.duration_months);
          return syncPaidToDue(due, next);
        }
      }
      if (key === 'trainer_package_id') {
        if (!value) {
          next.trainer_id = '';
          next.trainer_amount_paid = '0';
        } else {
          const pkg = trainerPackages.find((p) => String(p.id) === value);
          if (pkg) next.trainer_amount_paid = String(Number(pkg.price));
        }
      }
      return next;
    });
  }

  function toggleAddon(feeId: number) {
    setAddonIds((prev) => {
      const next = prev.includes(feeId) ? prev.filter((id) => id !== feeId) : [...prev, feeId];
      setForm((formPrev) => {
        if (!selectedPackage) return formPrev;
        const due =
          Number(selectedPackage.price) +
          selectedAddonTotal(fees, next, selectedPackage.duration_months);
        return syncPaidToDue(due, formPrev);
      });
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const contactError = validateContact(form.contact);
    if (contactError) {
      setError(contactError);
      return;
    }
    const cnicError = validateCnic(form.cnic);
    if (cnicError) {
      setError(cnicError);
      return;
    }
    if (!form.package_id) {
      setError('Select a gym package');
      return;
    }
    if (Number.isNaN(amountPaid) || amountPaid < 0) {
      setError('Gym amount paid must be zero or more');
      return;
    }
    if (form.trainer_package_id && (Number.isNaN(trainerPaid) || trainerPaid < 0)) {
      setError('Trainer amount paid must be zero or more');
      return;
    }

    setSaving(true);
    try {
      const member = await api.createMember({
        full_name: form.full_name.trim(),
        contact: form.contact.trim(),
        cnic: form.cnic.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        package_id: Number(form.package_id),
        amount_paid: amountPaid,
        start_date: form.start_date || undefined,
        trainer_package_id: form.trainer_package_id ? Number(form.trainer_package_id) : null,
        trainer_id: form.trainer_id ? Number(form.trainer_id) : null,
        trainer_amount_paid: form.trainer_package_id ? trainerPaid : 0,
        addon_fee_ids: addonIds,
      });
      navigate(`/members/${member.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not admit member');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New admission</h1>
          <p className="page-subtitle">Register a member with gym and optional trainer package.</p>
        </div>
        <Link to="/members" className="btn btn-outline">
          Back to members
        </Link>
      </div>

      {error ? <p className="banner banner-error">{error}</p> : null}

      <form className="card admit-form" onSubmit={handleSubmit}>
        <h2 className="section-title">Member details</h2>
        <div className="form-grid">
          <div className="input-field">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              placeholder="Mustafa Khan"
              required
            />
          </div>
          <div className="input-field">
            <label htmlFor="contact">Contact</label>
            <input
              id="contact"
              inputMode="tel"
              value={form.contact}
              onChange={(e) => updateField('contact', e.target.value)}
              placeholder="03XXXXXXXXX"
              required
            />
          </div>
          <div className="input-field">
            <label htmlFor="cnic">CNIC</label>
            <input
              id="cnic"
              inputMode="numeric"
              maxLength={15}
              value={form.cnic}
              onChange={(e) => updateField('cnic', formatCnic(e.target.value))}
              placeholder="XXXXX-XXXXXXX-X"
              required
            />
          </div>
          <div className="input-field">
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div className="input-field form-span-2">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              required
            />
          </div>
        </div>

        <h2 className="section-title">Gym package</h2>
        <div className="form-grid">
          <div className="input-field">
            <label htmlFor="package_id">Package</label>
            <select
              id="package_id"
              className="select-input"
              value={form.package_id}
              onChange={(e) => updateField('package_id', e.target.value)}
              disabled={loadingPackages || packages.length === 0}
              required
            >
              {packages.length === 0 ? <option value="">No active packages</option> : null}
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} — {formatMoney(pkg.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-field">
            <label htmlFor="start_date">Start date</label>
            <input
              id="start_date"
              type="date"
              value={form.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
              required
            />
          </div>
          <div className="input-field">
            <label htmlFor="amount_paid">Gym amount paid (Rs)</label>
            <input
              id="amount_paid"
              type="number"
              min={0}
              step="0.01"
              value={form.amount_paid}
              onChange={(e) => updateField('amount_paid', e.target.value)}
              required
            />
          </div>
        </div>

        <h2 className="section-title">Fee add-ons (optional)</h2>
        <p className="muted-line" style={{ marginTop: 0 }}>
          Select extra charges from the fee table. Per-month fees multiply by plan duration (
          {durationMonths} mo).
        </p>
        {fees.length === 0 ? (
          <p className="muted-line">No active fee items. Add them under Fee table.</p>
        ) : (
          <div className="addon-list">
            {fees.map((fee) => {
              const line = feeAddonLineAmount(fee, durationMonths);
              const checked = addonIds.includes(fee.id);
              return (
                <label key={fee.id} className={`addon-item${checked ? ' selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddon(fee.id)}
                  />
                  <span className="addon-item-body">
                    <strong>{fee.name}</strong>
                    <span className="muted-line">
                      {fee.unit}
                      {fee.unit.toLowerCase() === 'per month'
                        ? ` × ${durationMonths} = ${formatMoney(line)}`
                        : ` · ${formatMoney(line)}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="admit-summary">
          <div>
            <span className="summary-label">Plan</span>
            <strong>{selectedPackage ? formatMoney(packagePrice) : '—'}</strong>
          </div>
          {addonLines.map(({ fee, amount }) => (
            <div key={fee.id}>
              <span className="summary-label">{fee.name}</span>
              <strong>{formatMoney(amount)}</strong>
            </div>
          ))}
          <div>
            <span className="summary-label">Gym due</span>
            <strong>{selectedPackage ? formatMoney(amountDue) : '—'}</strong>
          </div>
          <div>
            <span className="summary-label">Gym end</span>
            <strong>
              {selectedPackage && form.start_date
                ? addMonthsISO(form.start_date, selectedPackage.duration_months)
                : '—'}
            </strong>
          </div>
          <div>
            <span className="summary-label">Gym payment</span>
            <strong>{selectedPackage ? paymentPreview(amountPaid, amountDue) : '—'}</strong>
          </div>
        </div>

        <h2 className="section-title">Trainer package (optional)</h2>
        <div className="form-grid">
          <div className="input-field form-span-2">
            <label htmlFor="trainer_package_id">Trainer package</label>
            <select
              id="trainer_package_id"
              className="select-input"
              value={form.trainer_package_id}
              onChange={(e) => updateField('trainer_package_id', e.target.value)}
            >
              <option value="">None</option>
              {trainerPackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} — {formatMoney(pkg.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-field">
            <label htmlFor="trainer_id">Assign trainer</label>
            <select
              id="trainer_id"
              className="select-input"
              value={form.trainer_id}
              onChange={(e) => updateField('trainer_id', e.target.value)}
              disabled={!form.trainer_package_id}
            >
              <option value="">Unassigned</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-field">
            <label htmlFor="trainer_amount_paid">Trainer amount paid (Rs)</label>
            <input
              id="trainer_amount_paid"
              type="number"
              min={0}
              step="0.01"
              value={form.trainer_amount_paid}
              onChange={(e) => updateField('trainer_amount_paid', e.target.value)}
              disabled={!form.trainer_package_id}
            />
          </div>
        </div>

        {selectedTrainerPackage ? (
          <div className="admit-summary">
            <div>
              <span className="summary-label">Trainer due</span>
              <strong>{formatMoney(trainerDue)}</strong>
            </div>
            <div>
              <span className="summary-label">Trainer end</span>
              <strong>
                {form.start_date
                  ? addMonthsISO(form.start_date, selectedTrainerPackage.duration_months)
                  : '—'}
              </strong>
            </div>
            <div>
              <span className="summary-label">Trainer payment</span>
              <strong>{paymentPreview(trainerPaid, trainerDue)}</strong>
            </div>
          </div>
        ) : null}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || loadingPackages || packages.length === 0}
          >
            {saving ? 'Saving…' : 'Admit member'}
          </button>
        </div>
      </form>
    </div>
  );
}
