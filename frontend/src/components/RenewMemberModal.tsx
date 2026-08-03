import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ApiError,
  api,
  formatMoney,
  type FeeItem,
  type Member,
  type Package,
  type Trainer,
  type TrainerPackage,
} from '../api/client';
import { feeAddonLineAmount, selectedAddonLines, selectedAddonTotal } from '../utils/fees';
import { Modal } from './Modal';

type RenewMemberModalProps = {
  member: Member;
  onClose: () => void;
  onRenewed: (member: Member) => void;
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

export function RenewMemberModal({ member, onClose, onRenewed }: RenewMemberModalProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [fees, setFees] = useState<FeeItem[]>([]);
  const [trainerPackages, setTrainerPackages] = useState<TrainerPackage[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addonIds, setAddonIds] = useState<number[]>([]);

  const [packageId, setPackageId] = useState(String(member.package_id));
  const [amountPaid, setAmountPaid] = useState(String(Number(member.package.price)));
  const [startDate, setStartDate] = useState(todayISO());
  const [trainerMode, setTrainerMode] = useState<'keep' | 'change' | 'clear'>('keep');
  const [trainerPackageId, setTrainerPackageId] = useState(
    member.trainer_package_id ? String(member.trainer_package_id) : '',
  );
  const [trainerAmountPaid, setTrainerAmountPaid] = useState(
    member.trainer_package ? String(Number(member.trainer_package.price)) : '0',
  );
  const [trainerId, setTrainerId] = useState(member.trainer_id ? String(member.trainer_id) : '');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
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

        const current = gymPlans.find((p) => p.id === member.package_id) ?? gymPlans[0];
        if (current) {
          setPackageId(String(current.id));
          setAmountPaid(String(Number(current.price)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load renewal options');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [member.package_id]);

  const selectedPackage = useMemo(
    () => packages.find((p) => String(p.id) === packageId) ?? null,
    [packages, packageId],
  );

  const selectedTrainerPackage = useMemo(
    () => trainerPackages.find((p) => String(p.id) === trainerPackageId) ?? null,
    [trainerPackages, trainerPackageId],
  );

  const durationMonths = selectedPackage?.duration_months ?? 1;
  const packagePrice = selectedPackage ? Number(selectedPackage.price) : 0;
  const addonLines = selectedAddonLines(fees, addonIds, durationMonths);
  const amountDue = packagePrice + selectedAddonTotal(fees, addonIds, durationMonths);
  const endDate = selectedPackage ? addMonthsISO(startDate, selectedPackage.duration_months) : '—';

  function applyDue(pkg: Package, ids: number[]) {
    setAmountPaid(String(Number(pkg.price) + selectedAddonTotal(fees, ids, pkg.duration_months)));
  }

  function toggleAddon(feeId: number) {
    setAddonIds((prev) => {
      const next = prev.includes(feeId) ? prev.filter((id) => id !== feeId) : [...prev, feeId];
      if (selectedPackage) applyDue(selectedPackage, next);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const paid = Number(amountPaid);
    if (!packageId) {
      setError('Select a gym package');
      return;
    }
    if (Number.isNaN(paid) || paid < 0) {
      setError('Amount paid must be zero or more');
      return;
    }

    const changingTrainer = trainerMode === 'change';
    const trainerPaid = Number(trainerAmountPaid);
    if (changingTrainer && !trainerPackageId) {
      setError('Select a trainer package or choose Keep / Clear');
      return;
    }
    if (changingTrainer && (Number.isNaN(trainerPaid) || trainerPaid < 0)) {
      setError('Trainer amount paid must be zero or more');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.renewMember(member.id, {
        package_id: Number(packageId),
        amount_paid: paid,
        start_date: startDate,
        clear_trainer: trainerMode === 'clear',
        trainer_package_id:
          trainerMode === 'change' && trainerPackageId ? Number(trainerPackageId) : undefined,
        trainer_amount_paid: trainerMode === 'change' ? trainerPaid : undefined,
        trainer_id:
          trainerMode === 'change' && trainerId
            ? Number(trainerId)
            : trainerMode === 'keep'
              ? undefined
              : null,
        addon_fee_ids: addonIds,
      });
      onRenewed(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not renew membership');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Renew — ${member.full_name}`} onClose={onClose}>
      {loading ? (
        <p className="muted-line">Loading packages…</p>
      ) : (
        <form className="modal-form" onSubmit={handleSubmit}>
          <p className="muted-line" style={{ margin: 0 }}>
            Current: {member.package.name} · ends {member.end_date}
          </p>

          <div className="input-field">
            <label htmlFor="renew-package">Gym package</label>
            <select
              id="renew-package"
              className="select-input"
              value={packageId}
              onChange={(e) => {
                const id = e.target.value;
                setPackageId(id);
                const pkg = packages.find((p) => String(p.id) === id);
                if (pkg) applyDue(pkg, addonIds);
              }}
              required
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} — {formatMoney(pkg.price)}
                </option>
              ))}
            </select>
          </div>

          <div className="input-field">
            <label htmlFor="renew-start">New start date</label>
            <input
              id="renew-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <fieldset className="addon-fieldset">
            <legend>Fee add-ons (optional)</legend>
            {fees.length === 0 ? (
              <p className="muted-line">No active fee items.</p>
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
          </fieldset>

          <div className="input-field">
            <label htmlFor="renew-paid">Amount paid now (Rs)</label>
            <input
              id="renew-paid"
              type="number"
              min={0}
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              required
            />
          </div>

          <div className="admit-summary">
            <div>
              <span className="summary-label">New end date</span>
              <strong>{endDate}</strong>
            </div>
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
              <span className="summary-label">Total due</span>
              <strong>{selectedPackage ? formatMoney(amountDue) : '—'}</strong>
            </div>
          </div>

          <div className="input-field">
            <label htmlFor="trainer-mode">Trainer package</label>
            <select
              id="trainer-mode"
              className="select-input"
              value={trainerMode}
              onChange={(e) => setTrainerMode(e.target.value as 'keep' | 'change' | 'clear')}
            >
              <option value="keep">
                Keep current {member.trainer_package ? `(${member.trainer_package.name})` : '(none)'}
              </option>
              <option value="change">Assign / change trainer package</option>
              <option value="clear">Clear trainer package</option>
            </select>
          </div>

          {trainerMode === 'change' ? (
            <>
              <div className="input-field">
                <label htmlFor="renew-trainer-pkg">Trainer plan</label>
                <select
                  id="renew-trainer-pkg"
                  className="select-input"
                  value={trainerPackageId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTrainerPackageId(id);
                    const pkg = trainerPackages.find((p) => String(p.id) === id);
                    if (pkg) setTrainerAmountPaid(String(Number(pkg.price)));
                  }}
                >
                  <option value="">Select…</option>
                  {trainerPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — {formatMoney(pkg.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-field">
                <label htmlFor="renew-trainer">Trainer</label>
                <select
                  id="renew-trainer"
                  className="select-input"
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
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
                <label htmlFor="renew-trainer-paid">Trainer amount paid (Rs)</label>
                <input
                  id="renew-trainer-paid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={trainerAmountPaid}
                  onChange={(e) => setTrainerAmountPaid(e.target.value)}
                />
              </div>
              {selectedTrainerPackage ? (
                <p className="muted-line">
                  Trainer ends {addMonthsISO(startDate, selectedTrainerPackage.duration_months)}
                </p>
              ) : null}
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || packages.length === 0}>
              {saving ? 'Renewing…' : 'Renew plan'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
