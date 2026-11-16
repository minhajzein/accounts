import api from "@/lib/axios";

const moneySafe = (n: unknown) => Number(n) || 0;

// ── Orders ───────────────────────────────────────────────────────────────────

export interface AccountsOrderRow {
  id: string;
  pickfooId?: string | null;
  status: string;
  paymentStatus?: string | null;
  orderType?: string;
  totalAmount?: number | null;
  itemTotal?: number | null;
  offerItemTotal?: number | null;
  discountAmount?: number | null;
  packingTotal?: number | null;
  deliveryFee?: number | null;
  gstAmount?: number | null;
  sgstAmount?: number | null;
  cgstAmount?: number | null;
  restaurantGstRegistered?: boolean;
  gstDestination?: "platform" | "restaurant" | null;
  platformCommission?: number | null;
  commissionPercent?: number | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  deliveryPartnerName?: string | null;
  createdAt: string;
}

export interface AccountsOrdersResponse {
  summary: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
    platformCommission: number;
    averageCommission: number;
    commissionableOrders: number;
  };
  data: AccountsOrderRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function fetchAccountsOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  restaurantId?: string;
  partnerId?: string;
  from?: string;
  to?: string;
}): Promise<AccountsOrdersResponse> {
  const { data } = await api.get(`/accounts/orders`, { params });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total ?? data.summary?.total) || 0;
  return {
    summary: {
      total: data.summary?.total ?? total,
      active: data.summary?.active ?? 0,
      delivered: data.summary?.delivered ?? 0,
      cancelled: data.summary?.cancelled ?? 0,
      platformCommission: moneySafe(data.summary?.platformCommission),
      averageCommission: moneySafe(data.summary?.averageCommission),
      commissionableOrders: moneySafe(data.summary?.commissionableOrders),
    },
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

// ── Restaurants ──────────────────────────────────────────────────────────────

export interface AccountsRestaurantListItem {
  _id: string;
  name: string;
  status?: string;
  contactNumber?: string;
  email?: string;
  commissionPercent?: number;
  isGstRegistered?: boolean;
  gstNumber?: string | null;
  address?: { city?: string; state?: string };
}

function normalizeRestaurantRow(row: any): AccountsRestaurantListItem {
  const gstNumber =
    (typeof row?.legalDocs?.gstNumber === "string" &&
      row.legalDocs.gstNumber.trim()) ||
    (typeof row?.gstNumber === "string" && row.gstNumber.trim()) ||
    null;
  return {
    _id: String(row?._id ?? ""),
    name: String(row?.name ?? ""),
    status: row?.status,
    contactNumber: row?.contactNumber,
    email: row?.email,
    commissionPercent: Number(row?.commissionPercent) || 0,
    gstNumber,
    isGstRegistered: Boolean(gstNumber) || Boolean(row?.isGstRegistered),
    address: row?.address
      ? { city: row.address.city, state: row.address.state }
      : undefined,
  };
}

export async function fetchAccountsRestaurants(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{
  data: AccountsRestaurantListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const { data } = await api.get(`/accounts/restaurants`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 25,
      search: params?.search?.trim() || undefined,
      status: params?.status || undefined,
    },
  });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || 25;
  const total = Number(data.total) || 0;
  const rows = Array.isArray(data.data) ? data.data : [];
  return {
    data: rows.map(normalizeRestaurantRow),
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export interface RestaurantLedgerSummary {
  restaurant: {
    _id: string;
    name: string;
    email?: string;
    contactNumber?: string;
    commissionPercent: number;
    status?: string;
    gstNumber?: string | null;
    isGstRegistered?: boolean;
  };
  summary: {
    availableBalance: number;
    totalCredit: number;
    totalDebit: number;
    creditCount: number;
    debitCount?: number;
    totalGrossSales: number;
    commissionEarned: number;
    totalGstInWallet?: number;
    gstToRestaurant?: number;
    gstToPlatform?: number;
    withdrawalsByStatus?: Record<string, { total: number; count: number }>;
    period?: {
      from: string | null;
      to: string | null;
      totalGrossSales: number;
      commissionEarned: number;
      gstToRestaurant: number;
      gstToPlatform: number;
      creditCount: number;
    };
  };
}

export interface RestaurantLedgerTx {
  _id: string;
  amount: number;
  status: string;
  type: "credit" | "debit" | "payout" | string;
  notes?: string;
  createdAt?: string;
  commissionAmount?: number | null;
  grossAmount?: number | null;
  gstAmount?: number | null;
  gstInRestaurantWallet?: boolean | null;
  gstDestination?: "restaurant" | "platform" | null;
  order?: { _id?: string; pickfooId?: string | null } | string | null;
}

export async function fetchRestaurantLedger(
  restaurantId: string,
  params?: { from?: string; to?: string },
): Promise<RestaurantLedgerSummary> {
  const { data } = await api.get(
    `/accounts/restaurants/${encodeURIComponent(restaurantId)}/ledger`,
    { params },
  );
  return data.data;
}

export async function fetchRestaurantLedgerTransactions(
  restaurantId: string,
  params?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    from?: string;
    to?: string;
  },
): Promise<RestaurantLedgerTx[]> {
  const { data } = await api.get(
    `/accounts/restaurants/${encodeURIComponent(restaurantId)}/ledger/transactions`,
    { params },
  );
  return data.data ?? [];
}

export async function downloadRestaurantMonthlyPdf(input: {
  restaurantId: string;
  year: number;
  month: number;
}): Promise<void> {
  const { data } = await api.get(
    `/accounts/restaurants/${encodeURIComponent(input.restaurantId)}/ledger/monthly-report.pdf`,
    {
      params: { year: input.year, month: input.month },
      responseType: "blob",
      timeout: 60000,
    },
  );
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pickfoo-restaurant-ledger-${input.year}-${String(input.month).padStart(2, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Partners ─────────────────────────────────────────────────────────────────

export interface AccountsPartnerListItem {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  status?: string;
  payoutMode?: string;
  deliveredOrderCount?: number;
}

export async function fetchAccountsPartners(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{
  data: AccountsPartnerListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const { data } = await api.get(`/accounts/partners`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 25,
      search: params?.search?.trim() || undefined,
      status: params?.status || undefined,
    },
  });
  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || 25;
  const total = Number(data.total) || 0;
  return {
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export interface PartnerLedgerSummary {
  partner: {
    _id: string;
    fullName: string;
    phone?: string;
    email?: string;
    status?: string;
    payoutMode?: string;
    deliveredOrderCount?: number;
  };
  summary: {
    availableBalance: number;
    pendingWithdrawal: number;
    lifetimeEarnings: number;
    weekEarnings: number;
    tipsTotal: number;
    tripCount: number;
    totalCredits: number;
    totalDebits: number;
    openWithdrawalHold: number;
    withdrawalsByStatus?: Record<string, { total: number; count: number }>;
  };
}

export interface PartnerLedgerTx {
  _id: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  pickfooId?: string;
  meta?: { note?: string; tipAmount?: number; deliveryFee?: number; purpose?: string; trigger?: string };
  createdAt?: string;
}

export async function fetchPartnerLedger(
  partnerId: string,
): Promise<PartnerLedgerSummary> {
  const { data } = await api.get(
    `/accounts/partners/${encodeURIComponent(partnerId)}/ledger`,
  );
  return data.data;
}

export async function fetchPartnerLedgerTransactions(
  partnerId: string,
  params?: {
    type?: string;
    direction?: string;
    search?: string;
    limit?: number;
    from?: string;
    to?: string;
  },
): Promise<PartnerLedgerTx[]> {
  const { data } = await api.get(
    `/accounts/partners/${encodeURIComponent(partnerId)}/ledger/transactions`,
    { params },
  );
  return data.data ?? [];
}
