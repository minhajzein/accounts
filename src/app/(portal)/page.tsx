"use client";

import { startTransition, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  Banknote,
  Clock,
  Download,
  Landmark,
  Loader2,
  Percent,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  DATE_PRESETS,
  periodLabelFor,
  rangeForPreset,
  startOfLocalDay,
  toYmd,
  type DatePreset,
} from "@/lib/date-presets";
import {
  downloadPlatformMonthlyGstCsv,
  downloadPlatformMonthlyReportPdf,
  fetchPlatformLedger,
  fetchPlatformSettlement,
  fetchPlatformWallet,
  pickBank,
  type PlatformLedgerEntry,
  type PlatformLedgerKind,
} from "@/lib/api/accounts-ledger";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import {
  downloadExcel,
  excelStamp,
  fetchAllPages,
  formatExcelDate,
} from "@/lib/export-excel";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const KIND_TABS: Array<{ id: PlatformLedgerKind; label: string }> = [
  { id: "all", label: "All activity" },
  { id: "commission", label: "Order payments" },
  { id: "restaurant_withdrawal", label: "Restaurant payouts" },
  { id: "partner_payout", label: "Partner payouts" },
  { id: "expense", label: "Expenses" },
  { id: "wallet_transfer", label: "Wallet transfers" },
];

function currentIstYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return money.format(value);
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function splitGst(totals?: {
  totalGst?: number;
  platformGstRetained?: number;
  restaurantGstPaid?: number;
} | null) {
  const platform = roundMoney(Number(totals?.platformGstRetained) || 0);
  const collected = roundMoney(Number(totals?.totalGst) || 0);
  const reportedRestaurant = roundMoney(Number(totals?.restaurantGstPaid) || 0);
  const restaurant =
    reportedRestaurant > 0
      ? reportedRestaurant
      : roundMoney(Math.max(0, collected - platform));
  const total = collected > 0 ? collected : roundMoney(platform + restaurant);
  return { platform, restaurant, total };
}

function entryAmount(row: PlatformLedgerEntry): number {
  const total = Number(row.totalAmount);
  if (Number.isFinite(total) && total > 0) return total;
  const amount = Number(row.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return (
    (Number(row.offerItemTotal) || Number(row.itemTotal) || 0) +
    (Number(row.packingTotal) || 0) +
    (Number(row.deliveryFee) || 0) +
    (Number(row.tipAmount) || 0) +
    (Number(row.gstAmount) || 0)
  );
}

function entryKind(
  row: PlatformLedgerEntry,
): Exclude<PlatformLedgerKind, "all"> {
  if (row.kind) return row.kind;
  if (row.tags?.length) return "expense";
  return "commission";
}

function entryDirection(row: PlatformLedgerEntry): "credit" | "debit" {
  if (row.direction) return row.direction;
  return entryKind(row) === "commission" || entryKind(row) === "wallet_transfer"
    ? "credit"
    : "debit";
}

function kindLabel(kind: Exclude<PlatformLedgerKind, "all">) {
  switch (kind) {
    case "commission":
      return "Order payment";
    case "restaurant_withdrawal":
      return "Restaurant payout";
    case "partner_payout":
      return "Partner payout";
    case "expense":
      return "Expense";
    case "wallet_transfer":
      return "Wallet transfer";
  }
}

function MiniStat({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-white/10 bg-white/5 text-white gap-0 py-0">
      <CardContent className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
          ) : (
            value
          )}
        </p>
        {hint ? <p className="mt-1 text-[11px] text-white/35">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function PlatformLedgerPage() {
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("last_7_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [kind, setKind] = useState<PlatformLedgerKind>("all");
  const istNow = useMemo(() => currentIstYearMonth(), []);
  const [reportYear, setReportYear] = useState(String(istNow.year));
  const [reportMonth, setReportMonth] = useState(String(istNow.month));

  const dateRange = useMemo(() => {
    if (preset === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const periodLabel = useMemo(
    () => periodLabelFor(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ["accounts-wallet"],
    queryFn: fetchPlatformWallet,
    staleTime: 60_000,
  });

  const { data: settlement, isLoading: isSettlementLoading } = useQuery({
    queryKey: ["accounts-settlement"],
    queryFn: fetchPlatformSettlement,
    staleTime: 60_000,
  });

  const { data: allTimeData } = useQuery({
    queryKey: ["accounts-ledger-all-time"],
    queryFn: () =>
      fetchPlatformLedger({
        page: 1,
        limit: 1,
        kind: "commission",
        includeWallet: false,
        includeAllTime: true,
        includeFilteredCommission: false,
      }),
    staleTime: 120_000,
    select: (res) => res.summary.allTime,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["accounts-ledger", page, dateRange.from, dateRange.to, kind],
    queryFn: () =>
      fetchPlatformLedger({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        kind,
        includeWallet: false,
        includeAllTime: false,
        includeFilteredCommission: true,
      }),
    placeholderData: keepPreviousData,
  });

  const pdfMutation = useMutation({
    mutationFn: () =>
      downloadPlatformMonthlyReportPdf({
        year: Number(reportYear),
        month: Number(reportMonth),
      }),
    onSuccess: () => toast.success("PDF downloaded"),
    onError: () => toast.error("Could not download PDF"),
  });

  const gstCsvMutation = useMutation({
    mutationFn: () =>
      downloadPlatformMonthlyGstCsv({
        year: Number(reportYear),
        month: Number(reportMonth),
      }),
    onSuccess: () => toast.success("GST CSV downloaded"),
    onError: () => toast.error("Could not download GST CSV"),
  });

  const excelMutation = useMutation({
    mutationFn: async () => {
      const rows = await fetchAllPages(
        (page, limit) =>
          fetchPlatformLedger({
            page,
            limit,
            from: dateRange.from,
            to: dateRange.to,
            kind,
            includeWallet: false,
            includeAllTime: false,
            includeFilteredCommission: false,
          }),
        { limit: 100 },
      );
      downloadExcel({
        filename: `pickfoo-platform-ledger-${excelStamp()}`,
        sheetName: "Platform ledger",
        columns: [
          { header: "When", value: (r) => formatExcelDate(r.createdAt) },
          { header: "Type", value: (r) => kindLabel(entryKind(r)) },
          { header: "Direction", value: (r) => entryDirection(r) },
          {
            header: "Party",
            value: (r) => r.partyName || r.restaurantName || "",
          },
          {
            header: "Reference",
            value: (r) => r.pickfooId || r.reference || r.id,
          },
          { header: "Status", value: (r) => r.status || "" },
          { header: "Amount", value: (r) => entryAmount(r) },
          {
            header: "Commission",
            value: (r) =>
              entryKind(r) === "commission"
                ? Number(r.platformCommission) || 0
                : "",
          },
          { header: "GST", value: (r) => Number(r.gstAmount) || 0 },
          {
            header: "GST destination",
            value: (r) => r.gstDestination || "",
          },
          { header: "Notes", value: (r) => r.notes || "" },
        ],
        rows,
      });
      return rows.length;
    },
    onSuccess: (count) => toast.success(`Exported ${count} rows to Excel`),
    onError: () => toast.error("Could not export Excel"),
  });

  const filtered = data?.summary.filtered;
  const periodGst = splitGst(filtered);
  const allTimeGst = splitGst(allTimeData);
  const rows = data?.data ?? [];
  const bank = pickBank(settlement, data?.summary.bank, wallet?.bank);
  const isBootstrapping =
    (isLoading && !data) ||
    (isWalletLoading && !wallet) ||
    (isSettlementLoading && !settlement);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        <p className="text-sm text-white/60">Loading platform ledger…</p>
        <p className="text-xs text-white/35">Fetching wallet, settlement & activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-(family-name:--font-fraunces)">
          Platform ledger
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Read-only view of order payments, restaurant & partner payouts,
          expenses, and wallet transfers. Export PDF/CSV for filing.
        </p>
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs text-white/50">Report year</Label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              className="h-9 w-28 border-white/15 bg-black/20 text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-white/50">Month</Label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="h-9 w-40 rounded-md border border-white/15 bg-black/20 px-3 text-sm text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString("en-IN", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
            disabled={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            {pdfMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Download monthly PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 text-white"
            disabled={gstCsvMutation.isPending}
            onClick={() => gstCsvMutation.mutate()}
          >
            {gstCsvMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Download GST CSV
          </Button>
          <ExportExcelButton
            loading={excelMutation.isPending}
            onClick={() => excelMutation.mutate()}
            label="Export ledger XL"
          />
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full overflow-hidden border-0 bg-[#98E32F] text-[#013644] gap-0 py-0">
          <CardContent className="relative p-5">
            <Landmark className="absolute right-3 top-3 opacity-20" size={48} />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
              Expected in platform bank
            </p>
            <p className="mt-2 text-3xl font-black">
              {isSettlementLoading && !settlement ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                formatMoney(bank?.expectedBankBalance)
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full border-white/10 bg-white/5 text-white gap-0 py-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Clock size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Pending Razorpay settlement
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {formatMoney(bank?.pendingRazorpaySettlement)}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full border-white/10 bg-white/5 text-white gap-0 py-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-amber-300" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to platform · {periodLabel}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-200">
              {formatMoney(periodGst.platform)}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              All time {formatMoney(allTimeGst.platform)}
            </p>
          </CardContent>
        </Card>
        <Card className="h-full border-white/10 bg-white/5 text-white gap-0 py-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-white/40">
              <Percent size={16} className="text-[#98E32F]" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                GST to restaurants · {periodLabel}
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#98E32F]">
              {formatMoney(periodGst.restaurant)}
            </p>
            <p className="mt-2 text-[11px] text-white/35">
              All time {formatMoney(allTimeGst.restaurant)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Owed in wallets"
          value={formatMoney(wallet?.availableBalance)}
          hint={`Restaurants ${formatMoney(wallet?.restaurant.availableBalance)} · Partners ${formatMoney(wallet?.partner.availableBalance)}`}
          loading={isWalletLoading}
        />
        <MiniStat
          label="Platform wallet"
          value={formatMoney(
            wallet?.platform?.netBalance ?? wallet?.platform?.retainedBalance,
          )}
          hint={`Bank after owed wallets + expenses · expenses ${formatMoney(wallet?.platform?.expensesTotal)} · partner bonuses ${formatMoney(wallet?.platform?.partnerBonusTotal)}`}
          loading={isWalletLoading}
        />
        <MiniStat
          label="Restaurant payouts paid"
          value={formatMoney(wallet?.restaurant.withdrawalsPaid)}
          loading={isWalletLoading}
        />
        <MiniStat
          label="Partner payouts paid"
          value={formatMoney(wallet?.partner.payoutsPaid)}
          loading={isWalletLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              startTransition(() => {
                setPreset(p.id);
                setPage(1);
                if (p.id === "custom" && !customFrom && !customTo) {
                  const today = toYmd(startOfLocalDay(new Date()));
                  setCustomFrom(today);
                  setCustomTo(today);
                }
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs border transition-colors",
              preset === p.id
                ? "border-[#98E32F]/40 bg-[#98E32F]/15 text-[#98E32F]"
                : "border-white/10 text-white/50 hover:border-white/25",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap gap-3">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-40 border-white/15 bg-black/20 text-white"
          />
          <Input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-40 border-white/15 bg-black/20 text-white"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              startTransition(() => {
                setKind(tab.id);
                setPage(1);
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs border transition-colors",
              kind === tab.id
                ? "border-[#98E32F]/40 bg-[#98E32F]/15 text-[#98E32F]"
                : "border-white/10 text-white/50 hover:border-white/25",
            )}
          >
            {tab.label}
          </button>
        ))}
        {isFetching && !isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#98E32F] self-center" />
        ) : null}
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">When</TableHead>
              <TableHead className="text-white/50">Type</TableHead>
              <TableHead className="text-white/50">Dir</TableHead>
              <TableHead className="text-white/50">Party</TableHead>
              <TableHead className="text-white/50">Ref</TableHead>
              <TableHead className="text-white/50">Status</TableHead>
              <TableHead className="text-white/50 text-right">Amount</TableHead>
              <TableHead className="text-white/50 text-right">
                Commission
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#98E32F] mx-auto" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-white/40"
                >
                  No ledger entries for this filter
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const k = entryKind(row);
                const dir = entryDirection(row);
                return (
                  <TableRow key={row.id} className="border-white/5">
                    <TableCell className="text-white/70 text-xs">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{kindLabel(k)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          dir === "credit"
                            ? "border-[#98E32F]/30 bg-[#98E32F]/15 text-[#98E32F]"
                            : "border-red-500/30 bg-red-500/15 text-red-300"
                        }
                      >
                        {dir}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.partyName || row.restaurantName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-white/50 font-mono">
                      {row.pickfooId || row.reference || row.id.slice(-6)}
                    </TableCell>
                    <TableCell className="text-xs text-white/50">
                      {row.status || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(entryAmount(row))}
                    </TableCell>
                    <TableCell className="text-right text-white/60">
                      {k === "commission"
                        ? formatMoney(row.platformCommission)
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <ListPagination
          page={page}
          total={data?.total ?? 0}
          totalPages={data?.totalPages}
          onPageChange={(next) => startTransition(() => setPage(next))}
        />
      </Card>

      <p className="text-[11px] text-white/30 flex items-center gap-1.5">
        <Wallet className="h-3 w-3" />
        <Banknote className="h-3 w-3" />
        Accounts portal cannot create expenses, approve payouts, or mutate
        ledger data.
      </p>
    </div>
  );
}
