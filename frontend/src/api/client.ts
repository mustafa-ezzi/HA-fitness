const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type User = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type Package = {
  id: number;
  name: string;
  duration_months: number;
  price: string;
  is_active: boolean;
  created_at: string;
};

export type PackageBrief = {
  id: number;
  name: string;
  duration_months: number;
  price: string;
};

export type PackagePayload = {
  name: string;
  duration_months: number;
  price: number;
  is_active?: boolean;
};

export type TrainerPackageCategory =
  | 'training_guidance'
  | 'group_training'
  | 'personal_training';

export type TrainerPackage = {
  id: number;
  category: TrainerPackageCategory;
  name: string;
  duration_months: number;
  price: string;
  is_active: boolean;
  created_at: string;
};

export type TrainerPackageBrief = {
  id: number;
  category: TrainerPackageCategory;
  name: string;
  duration_months: number;
  price: string;
};

export type TrainerPackagePayload = {
  category: TrainerPackageCategory;
  name: string;
  duration_months: number;
  price: number;
  is_active?: boolean;
};

export type Trainer = {
  id: number;
  full_name: string;
  contact: string;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
};

export type TrainerBrief = {
  id: number;
  full_name: string;
  contact: string;
  specialty: string | null;
};

export type TrainerPayload = {
  full_name: string;
  contact: string;
  specialty?: string | null;
  is_active?: boolean;
};

export type FeeItem = {
  id: number;
  name: string;
  price: string;
  unit: string;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type FeePayload = {
  name: string;
  price: number;
  unit?: string;
  notes?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type Member = {
  id: number;
  full_name: string;
  contact: string;
  cnic: string;
  email: string | null;
  address: string;
  package_id: number;
  package: PackageBrief;
  start_date: string;
  end_date: string;
  payment_status: 'paid' | 'unpaid' | 'partial';
  amount_due: string;
  amount_paid: string;
  trainer_package_id: number | null;
  trainer_package: TrainerPackageBrief | null;
  trainer_id: number | null;
  trainer: TrainerBrief | null;
  trainer_start_date: string | null;
  trainer_end_date: string | null;
  trainer_amount_due: string | null;
  trainer_amount_paid: string | null;
  trainer_payment_status: 'paid' | 'unpaid' | 'partial' | null;
  status: 'active' | 'expired' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type MemberCreatePayload = {
  full_name: string;
  contact: string;
  cnic: string;
  email?: string | null;
  address: string;
  package_id: number;
  amount_paid: number;
  start_date?: string;
  trainer_package_id?: number | null;
  trainer_id?: number | null;
  trainer_amount_paid?: number;
  addon_fee_ids?: number[];
};

export type MemberUpdatePayload = {
  full_name?: string;
  contact?: string;
  cnic?: string;
  email?: string | null;
  address?: string;
  status?: 'active' | 'expired' | 'inactive';
  trainer_id?: number | null;
};

export type MemberListParams = {
  q?: string;
  status?: string;
  payment_status?: string;
};

export type PaymentKind = 'gym' | 'trainer';

export type Payment = {
  id: number;
  member_id: number;
  kind: PaymentKind;
  amount: string;
  note: string | null;
  paid_at: string;
  recorded_by: string;
  member_name?: string | null;
};

export type PaymentWithMember = Payment & {
  member_name: string;
  member_payment_status?: string | null;
  member_trainer_payment_status?: string | null;
};

export type PaymentCreatePayload = {
  amount: number;
  note?: string | null;
  kind?: PaymentKind;
};

export type AlertItem = {
  member_id: number;
  member_name: string;
  contact: string;
  alert_type: 'expired' | 'expiring_soon' | 'trainer_expired' | 'trainer_expiring_soon';
  scope: 'gym' | 'trainer';
  package_name: string;
  end_date: string;
  days_left: number;
  payment_status: string | null;
  status: string;
};

export type AlertsResponse = {
  expired: AlertItem[];
  expiring_soon: AlertItem[];
  total: number;
  synced: number;
};

export type RenewPayload = {
  package_id: number;
  amount_paid: number;
  start_date?: string;
  trainer_package_id?: number | null;
  trainer_amount_paid?: number;
  trainer_id?: number | null;
  clear_trainer?: boolean;
  addon_fee_ids?: number[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem('ha_gym_token');
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('ha_gym_token', token);
  } else {
    localStorage.removeItem('ha_gym_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        message = data.detail.map((item: { msg?: string }) => item.msg ?? 'Invalid input').join('; ');
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string; app: string }>('/api/health'),
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<User>('/api/auth/me'),

  listPackages: (activeOnly = false) =>
    request<Package[]>(`/api/packages${activeOnly ? '?active_only=true' : ''}`),
  createPackage: (payload: PackagePayload) =>
    request<Package>('/api/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePackage: (id: number, payload: Partial<PackagePayload>) =>
    request<Package>(`/api/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  togglePackage: (id: number) =>
    request<Package>(`/api/packages/${id}/toggle`, { method: 'POST' }),
  deletePackage: (id: number) =>
    request<{ message: string }>(`/api/packages/${id}`, { method: 'DELETE' }),

  listMembers: (params: MemberListParams = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.status) search.set('status', params.status);
    if (params.payment_status) search.set('payment_status', params.payment_status);
    const qs = search.toString();
    return request<Member[]>(`/api/members${qs ? `?${qs}` : ''}`);
  },
  getMember: (id: number) => request<Member>(`/api/members/${id}`),
  createMember: (payload: MemberCreatePayload) =>
    request<Member>('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: number, payload: MemberUpdatePayload) =>
    request<Member>(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMember: (id: number) =>
    request<{ message: string }>(`/api/members/${id}`, { method: 'DELETE' }),

  listMemberPayments: (memberId: number) =>
    request<Payment[]>(`/api/members/${memberId}/payments`),
  createMemberPayment: (memberId: number, payload: PaymentCreatePayload) =>
    request<Payment>(`/api/members/${memberId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listPayments: (params: { limit?: number; kind?: PaymentKind } = {}) => {
    const search = new URLSearchParams();
    if (params.limit) search.set('limit', String(params.limit));
    if (params.kind) search.set('kind', params.kind);
    const qs = search.toString();
    return request<PaymentWithMember[]>(`/api/payments${qs ? `?${qs}` : ''}`);
  },
  deletePayment: (id: number) =>
    request<{ message: string }>(`/api/payments/${id}`, { method: 'DELETE' }),

  listAlerts: (days = 7) => request<AlertsResponse>(`/api/alerts?days=${days}`),
  syncAlerts: () => request<{ message: string }>('/api/alerts/sync', { method: 'POST' }),
  renewMember: (id: number, payload: RenewPayload) =>
    request<Member>(`/api/members/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listFees: (activeOnly = false) =>
    request<FeeItem[]>(`/api/fees${activeOnly ? '?active_only=true' : ''}`),
  createFee: (payload: FeePayload) =>
    request<FeeItem>('/api/fees', { method: 'POST', body: JSON.stringify(payload) }),
  updateFee: (id: number, payload: Partial<FeePayload>) =>
    request<FeeItem>(`/api/fees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFee: (id: number) =>
    request<{ message: string }>(`/api/fees/${id}`, { method: 'DELETE' }),

  listTrainers: (activeOnly = false) =>
    request<Trainer[]>(`/api/trainers${activeOnly ? '?active_only=true' : ''}`),
  createTrainer: (payload: TrainerPayload) =>
    request<Trainer>('/api/trainers', { method: 'POST', body: JSON.stringify(payload) }),
  updateTrainer: (id: number, payload: Partial<TrainerPayload>) =>
    request<Trainer>(`/api/trainers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleTrainer: (id: number) =>
    request<Trainer>(`/api/trainers/${id}/toggle`, { method: 'POST' }),
  deleteTrainer: (id: number) =>
    request<{ message: string }>(`/api/trainers/${id}`, { method: 'DELETE' }),

  listTrainerPackages: (params: { activeOnly?: boolean; category?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.activeOnly) search.set('active_only', 'true');
    if (params.category) search.set('category', params.category);
    const qs = search.toString();
    return request<TrainerPackage[]>(`/api/trainer-packages${qs ? `?${qs}` : ''}`);
  },
  createTrainerPackage: (payload: TrainerPackagePayload) =>
    request<TrainerPackage>('/api/trainer-packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTrainerPackage: (id: number, payload: Partial<TrainerPackagePayload>) =>
    request<TrainerPackage>(`/api/trainer-packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleTrainerPackage: (id: number) =>
    request<TrainerPackage>(`/api/trainer-packages/${id}/toggle`, { method: 'POST' }),
  deleteTrainerPackage: (id: number) =>
    request<{ message: string }>(`/api/trainer-packages/${id}`, { method: 'DELETE' }),
};

export function formatMoney(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) return String(value);
  return `Rs ${amount.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function paymentLabel(status: Member['payment_status'] | string | null | undefined): string {
  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  if (status === 'unpaid') return 'Unpaid';
  return '—';
}

export function memberStatusLabel(status: Member['status']): string {
  if (status === 'active') return 'Active';
  if (status === 'expired') return 'Expired';
  return 'Inactive';
}

export function trainerCategoryLabel(category: TrainerPackageCategory | string): string {
  if (category === 'training_guidance') return 'Training Guidance';
  if (category === 'group_training') return 'Group Training';
  if (category === 'personal_training') return 'Personal Training';
  return category;
}
