import api from "@/lib/axios";

export type PlatformLedgerKind =
  | "all"
  | "commission"
  | "restaurant_withdrawal"
  | "partner_payout"
  | "expense"
  | "wallet_transfer";

export type PlatformLedgerDirection = "credit" | "debit";

export interface PlatformLedgerEntry {
  id: string;
  kind?: Exclude<PlatformLedgerKind, "all">;
  direction?: PlatformLedgerDirection;
  amount?: number;
  status?: string | null;
  partyType?: "restaurant" | "partner" | "platform" | "vendor" | null;
  partyId?: string | null;
  partyName?: string | null;
  reference?: string | null;
  notes?: string | null;
  tags?: string[];
  invoiceRef?: string | null;
  pickfooId?: string | null;
  paymentStatus?: string | null;
  orderType?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  itemTotal?: number;
  offerItemTotal?: number;
  discountAmount?: number;
  packingTotal?: number;
  deliveryFee?: number;
  tipAmount?: number;
  gstAmount?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  platformGst?: number;
  gstDestination?: "restaurant" | "platform" | null;
  totalAmount?: number | null;
  commissionPercent?: number;
  platformCommission?: number;
  createdAt?: string | null;
}

export interface PlatformLedgerTotals {
  totalCommission: number;
  orderCount: number;
  avgCommission: number;
  totalGst: number;
  platformGstRetained: number;
  restaurantGstPaid: number;
}

export interface WalletStatusBucket {
  total: number;
  count: number;
}

export interface PlatformWalletSide {
  availableBalance: number;
  pendingPayouts: number;
  pendingPayoutCount?: number;
  openWithdrawalHold?: number;
  openWithdrawalCount?: number;
  settledBalance?: number;
  totalCredits: number;
  totalDebits: number;
  creditCount: number;
  debitCount: number;
  withdrawalsPaid?: number;
  payoutsPaid?: number;
  withdrawalsByStatus: Record<string, WalletStatusBucket>;
}

export interface PlatformSettlementBatch {
  amount: number;
  settleAt: string;
}

export interface PlatformBankSettlement {
  expectedBankBalance: number;
  collections: number;
  settledCollections: number;
  pendingRazorpaySettlement: number;
  restaurantPendingSettlement: number;
  restaurantWithdrawalsPaid: number;
  partnerPayoutsPaid: number;
  nextSettlementAt: string | null;
  pendingByDate: PlatformSettlementBatch[];
}

export interface PlatformWalletSummary {
  availableBalance: number;
  pendingPayouts: number;
  totalCredits: number;
  totalDebits: number;
  bank?: PlatformBankSettlement | null;
  restaurant: PlatformWalletSide;
  partner: PlatformWalletSide;
  platform: {
    retainedBalance: number;
    transferBalance?: number;
    transferCount: number;
    expensesTotal?: number;
    expensesCount?: number;
    partnerBonusTotal?: number;
    partnerBonusCount?: number;
    /** Settled bank − owed wallets − expenses. */
    netBalance?: number;
  };
}

export interface PlatformLedgerResponse {
  summary: {
    from: string | null;
    to: string | null;
    filtered: PlatformLedgerTotals;
    allTime: PlatformLedgerTotals;
    wallet: PlatformWalletSummary | null;
    bank?: PlatformBankSettlement | null;
  };
  kind: PlatformLedgerKind;
  data: PlatformLedgerEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type PartnerAdjustmentPurpose =
  | "all"
  | "partner_incentive"
  | "refund_clawback"
  | "admin_adjustment"
  | "restaurant_transfer";

export interface PartnerAdjustmentEntry {
  id: string;
  kind: "partner_adjustment";
  purpose: string;
  direction: "credit" | "debit";
  amount: number;
  partnerId: string | null;
  partnerName: string | null;
  partnerPhone: string | null;
  pickfooId: string | null;
  note: string | null;
  createdAt: string | null;
}

export interface PartnerAdjustmentsResponse {
  summary: {
    from: string | null;
    to: string | null;
    purpose: string;
    totalCredits: number;
    totalDebits: number;
    creditCount: number;
    debitCount: number;
    net: number;
  };
  data: PartnerAdjustmentEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function emptyWalletSide(): PlatformWalletSide {
  return {
    availableBalance: 0,
    pendingPayouts: 0,
    pendingPayoutCount: 0,
    totalCredits: 0,
    totalDebits: 0,
    creditCount: 0,
    debitCount: 0,
    withdrawalsByStatus: {},
  };
}

function emptyBank(): PlatformBankSettlement {
  return {
    expectedBankBalance: 0,
    collections: 0,
    settledCollections: 0,
    pendingRazorpaySettlement: 0,
    restaurantPendingSettlement: 0,
    restaurantWithdrawalsPaid: 0,
    partnerPayoutsPaid: 0,
    nextSettlementAt: null,
    pendingByDate: [],
  };
}

function emptyWallet(): PlatformWalletSummary {
  return {
    availableBalance: 0,
    pendingPayouts: 0,
    totalCredits: 0,
    totalDebits: 0,
    bank: emptyBank(),
    restaurant: emptyWalletSide(),
    partner: emptyWalletSide(),
    platform: {
      retainedBalance: 0,
      transferBalance: 0,
      transferCount: 0,
      expensesTotal: 0,
      expensesCount: 0,
      partnerBonusTotal: 0,
      partnerBonusCount: 0,
      netBalance: 0,
    },
  };
}

function mapWalletSide(raw: unknown): PlatformWalletSide {
  const r = (raw ?? {}) as Record<string, unknown>;
  const byStatus = (r.withdrawalsByStatus ?? {}) as Record<
    string,
    { total?: number; count?: number }
  >;
  const withdrawalsByStatus: Record<string, WalletStatusBucket> = {};
  for (const [k, v] of Object.entries(byStatus)) {
    withdrawalsByStatus[k] = {
      total: Number(v?.total) || 0,
      count: Number(v?.count) || 0,
    };
  }
  return {
    availableBalance: Number(r.availableBalance) || 0,
    pendingPayouts: Number(r.pendingPayouts) || 0,
    pendingPayoutCount: Number(r.pendingPayoutCount) || 0,
    openWithdrawalHold: Number(r.openWithdrawalHold) || 0,
    openWithdrawalCount: Number(r.openWithdrawalCount) || 0,
    settledBalance: Number(r.settledBalance) || 0,
    totalCredits: Number(r.totalCredits) || 0,
    totalDebits: Number(r.totalDebits) || 0,
    creditCount: Number(r.creditCount) || 0,
    debitCount: Number(r.debitCount) || 0,
    withdrawalsPaid: Number(r.withdrawalsPaid) || 0,
    payoutsPaid: Number(r.payoutsPaid) || 0,
    withdrawalsByStatus,
  };
}

function mapBank(raw: unknown): PlatformBankSettlement {
  if (!raw || typeof raw !== "object") return emptyBank();
  const b = raw as Record<string, unknown>;
  const batches = Array.isArray(b.pendingByDate) ? b.pendingByDate : [];
  return {
    expectedBankBalance: Number(b.expectedBankBalance) || 0,
    collections: Number(b.collections) || 0,
    settledCollections: Number(b.settledCollections) || 0,
    pendingRazorpaySettlement: Number(b.pendingRazorpaySettlement) || 0,
    restaurantPendingSettlement: Number(b.restaurantPendingSettlement) || 0,
    restaurantWithdrawalsPaid: Number(b.restaurantWithdrawalsPaid) || 0,
    partnerPayoutsPaid: Number(b.partnerPayoutsPaid) || 0,
    nextSettlementAt:
      typeof b.nextSettlementAt === "string" ? b.nextSettlementAt : null,
    pendingByDate: batches
      .map((row) => {
        const r = row as { amount?: number; settleAt?: string };
        return {
          amount: Number(r.amount) || 0,
          settleAt: String(r.settleAt || ""),
        };
      })
      .filter((row) => row.amount > 0 && row.settleAt),
  };
}

function mapWallet(raw: unknown): PlatformWalletSummary {
  if (!raw || typeof raw !== "object") return emptyWallet();
  const walletRaw = raw as Record<string, unknown>;
  return {
    availableBalance: Number(walletRaw.availableBalance) || 0,
    pendingPayouts: Number(walletRaw.pendingPayouts) || 0,
    totalCredits: Number(walletRaw.totalCredits) || 0,
    totalDebits: Number(walletRaw.totalDebits) || 0,
    bank: mapBank(walletRaw.bank),
    restaurant: mapWalletSide(walletRaw.restaurant),
    partner: mapWalletSide(walletRaw.partner),
    platform: (() => {
      const p = (walletRaw.platform ?? {}) as Record<string, unknown>;
      return {
        retainedBalance: Number(p.retainedBalance) || 0,
        transferBalance: Number(p.transferBalance ?? p.retainedBalance) || 0,
        transferCount: Number(p.transferCount) || 0,
        expensesTotal: Number(p.expensesTotal) || 0,
        expensesCount: Number(p.expensesCount) || 0,
        partnerBonusTotal: Number(p.partnerBonusTotal) || 0,
        partnerBonusCount: Number(p.partnerBonusCount) || 0,
        netBalance:
          p.netBalance != null ? Number(p.netBalance) || 0 : undefined,
      };
    })(),
  };
}

function isEmptyBank(bank: PlatformBankSettlement): boolean {
  return (
    bank.pendingRazorpaySettlement === 0 &&
    bank.expectedBankBalance === 0 &&
    bank.settledCollections === 0 &&
    bank.collections === 0 &&
    bank.restaurantWithdrawalsPaid === 0 &&
    bank.partnerPayoutsPaid === 0
  );
}

export function pickBank(
  ...candidates: Array<PlatformBankSettlement | null | undefined>
): PlatformBankSettlement {
  for (const candidate of candidates) {
    if (candidate && !isEmptyBank(candidate)) return candidate;
  }
  return emptyBank();
}

export async function fetchPlatformSettlement(): Promise<PlatformBankSettlement> {
  const { data } = await api.get(`/accounts/ledger/settlement`, {
    timeout: 30000,
  });
  return mapBank(data.bank ?? data.data ?? data);
}

export async function fetchPlatformWallet(): Promise<PlatformWalletSummary> {
  const { data } = await api.get(`/accounts/ledger/wallet`, {
    timeout: 30000,
  });
  const wallet = mapWallet(data.wallet ?? data.data ?? data);
  const bank = pickBank(mapBank(data.bank), wallet.bank);
  return { ...wallet, bank };
}

export async function fetchPlatformLedger(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  kind?: PlatformLedgerKind;
  includeWallet?: boolean;
  includeAllTime?: boolean;
  includeFilteredCommission?: boolean;
}): Promise<PlatformLedgerResponse> {
  const { data } = await api.get(`/accounts/ledger`, {
    params: {
      page: params?.page,
      limit: params?.limit,
      from: params?.from || undefined,
      to: params?.to || undefined,
      kind: params?.kind || "all",
      includeWallet: params?.includeWallet ?? false,
      includeAllTime: params?.includeAllTime ?? false,
      includeFilteredCommission: params?.includeFilteredCommission ?? true,
    },
  });

  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  const filtered = data.summary?.filtered ?? {};
  const allTime = data.summary?.allTime ?? {};
  const walletRaw = data.summary?.wallet;

  return {
    summary: {
      from: data.summary?.from ?? null,
      to: data.summary?.to ?? null,
      filtered: {
        totalCommission: Number(filtered.totalCommission) || 0,
        orderCount: Number(filtered.orderCount) || 0,
        avgCommission: Number(filtered.avgCommission) || 0,
        totalGst: Number(filtered.totalGst) || 0,
        platformGstRetained: Number(filtered.platformGstRetained) || 0,
        restaurantGstPaid: Number(filtered.restaurantGstPaid) || 0,
      },
      allTime: {
        totalCommission: Number(allTime.totalCommission) || 0,
        orderCount: Number(allTime.orderCount) || 0,
        avgCommission: Number(allTime.avgCommission) || 0,
        totalGst: Number(allTime.totalGst) || 0,
        platformGstRetained: Number(allTime.platformGstRetained) || 0,
        restaurantGstPaid: Number(allTime.restaurantGstPaid) || 0,
      },
      wallet: walletRaw ? mapWallet(walletRaw) : null,
      bank: mapBank(data.summary?.bank ?? data.bank),
    },
    kind: (data.kind as PlatformLedgerKind) || params?.kind || "all",
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export async function fetchPartnerAdjustments(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  direction?: "credit" | "debit";
  purpose?: PartnerAdjustmentPurpose;
  search?: string;
}): Promise<PartnerAdjustmentsResponse> {
  const { data } = await api.get(`/accounts/ledger/partner-adjustments`, {
    params: {
      page: params?.page,
      limit: params?.limit,
      from: params?.from || undefined,
      to: params?.to || undefined,
      direction: params?.direction || undefined,
      purpose: params?.purpose || "all",
      search: params?.search || undefined,
    },
  });

  const page = Number(data.page) || 1;
  const limit = Number(data.limit) || params?.limit || 25;
  const total = Number(data.total) || 0;
  const summary = data.summary ?? {};

  return {
    summary: {
      from: summary.from ?? null,
      to: summary.to ?? null,
      purpose: summary.purpose ?? params?.purpose ?? "all",
      totalCredits: Number(summary.totalCredits) || 0,
      totalDebits: Number(summary.totalDebits) || 0,
      creditCount: Number(summary.creditCount) || 0,
      debitCount: Number(summary.debitCount) || 0,
      net: Number(summary.net) || 0,
    },
    data: data.data ?? [],
    page,
    limit,
    total,
    totalPages:
      Number(data.totalPages) || Math.max(1, Math.ceil(total / limit) || 1),
  };
}

export async function downloadPlatformMonthlyReportPdf(input: {
  year: number;
  month: number;
}): Promise<void> {
  const { data } = await api.get(`/accounts/ledger/monthly-report.pdf`, {
    params: { year: input.year, month: input.month },
    responseType: "blob",
    timeout: 60000,
  });
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pickfoo-platform-ledger-${input.year}-${String(input.month).padStart(2, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadPlatformMonthlyGstCsv(input: {
  year: number;
  month: number;
}): Promise<void> {
  const { data } = await api.get(`/accounts/ledger/monthly-gst.csv`, {
    params: { year: input.year, month: input.month },
    responseType: "blob",
    timeout: 60000,
  });
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pickfoo-platform-gst-${input.year}-${String(input.month).padStart(2, "0")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
