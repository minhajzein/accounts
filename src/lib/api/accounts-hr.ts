import api from "@/lib/axios";

export type EmployeeStatus = "active" | "inactive";

export interface EmployeeSalaryPayment {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  amount: number;
  paidAt: string;
  bookEntryId?: string | null;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  monthlySalary: number;
  status: EmployeeStatus;
  joinDate?: string | null;
  notes?: string;
  salaryMonth?: {
    year: number;
    month: number;
    paid: boolean;
    payment: EmployeeSalaryPayment | null;
  };
}

export async function fetchAccountsEmployees(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: "active" | "inactive" | "all";
  year?: number;
  month?: number;
}): Promise<{
  data: Employee[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  year: number;
  month: number;
}> {
  const { data } = await api.get(`/accounts/employees`, { params });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  return {
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
    year: Number(data.year) || params?.year || new Date().getFullYear(),
    month: Number(data.month) || params?.month || new Date().getMonth() + 1,
  };
}

export type PlatformExpenseTag = "bills" | "salary" | "office" | "other";

export interface PlatformExpenseRow {
  id: string;
  amount: number;
  tag: PlatformExpenseTag | string;
  tags: string[];
  occurredAt: string;
  notes: string;
  invoiceRef: string;
  partyName: string | null;
}

export async function fetchAccountsExpenses(params?: {
  page?: number;
  limit?: number;
  year?: number;
  month?: number;
  from?: string;
  to?: string;
}): Promise<{
  data: PlatformExpenseRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const { data } = await api.get(`/accounts/expenses`, { params });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  return {
    data: (data.data ?? []).map((row: any) => ({
      id: String(row.id || row._id),
      amount: Number(row.amount) || 0,
      tag: row.tag || row.tags?.[0] || "other",
      tags: row.tags ?? [],
      occurredAt: row.occurredAt,
      notes: row.notes || "",
      invoiceRef: row.invoiceRef || "",
      partyName: row.partyName ?? null,
    })),
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}
