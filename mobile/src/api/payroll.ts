import { api } from './client';

export interface PayStub {
  id: string;
  user_id: string;
  full_name?: string;
  period_start: string;
  period_end: string;
  pay_type: 'commission' | 'hourly' | 'salary';
  hours_worked: number | null;
  hourly_rate: number | null;
  gross_commission: number;
  chargebacks: number;
  bonus: number;
  net_pay: number;
  sales_count: number;
  status: 'draft' | 'approved' | 'released';
  approved_at: string | null;
  released_at: string | null;
  manager_notes: string | null;
}

export const payrollApi = {
  stubs:   () => api.get<{ data: PayStub[] }>('/api/payroll/stubs'),
  periods: () => api.get<{ data: Array<{ id: string; period_start: string; period_end: string; status: string }> }>('/api/payroll/periods'),
};
