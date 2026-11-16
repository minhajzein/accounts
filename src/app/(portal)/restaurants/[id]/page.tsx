"use client";

import { startTransition, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DATE_PRESETS,
  periodLabelFor,
  rangeForPreset,
  startOfLocalDay,
  toYmd,
  type DatePreset,
} from "@/lib/date-presets";
import {
  downloadRestaurantMonthlyPdf,
  fetchRestaurantLedger,
  fetchRestaurantLedgerTransactions,
  type RestaurantLedgerTx,
} from "@/lib/api/accounts-entities";
import { getApiErrorMessage } from "@/lib/axios";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

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

function orderLabel(tx: RestaurantLedgerTx) {
  const order = tx.order;
  if (!order) return "—";
  if (typeof order === "string") return order.slice(-6);
  return order.pickfooId || String(order._id ?? "").slice(-6) || "—";
}

function gstDest(tx: RestaurantLedgerTx): "restaurant" | "platform" | null {
  if (tx.gstDestination) return tx.gstDestination;
  if (tx.gstInRestaurantWallet === true) return "restaurant";
  if (tx.gstInRestaurantWallet === false) return "platform";
  return null;
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

export default function RestaurantLedgerPage() {
  const params = useParams();
  const restaurantId = String(params.id || "");
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [txType, setTxType] = useState<"all" | "credit" | "debit" | "payout">(
    "all",
  );
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

  const {
    data: ledger,
    isLoading: isLedgerLoading,
    isError: isLedgerError,
    error: ledgerError,
    refetch: refetchLedger,
  } = useQuery({
    queryKey: [
      "accounts-restaurant-ledger",
      restaurantId,
      dateRange.from,
      dateRange.to,
    ],
    queryFn: () =>
      fetchRestaurantLedger(restaurantId, {
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(restaurantId),
    placeholderData: keepPreviousData,
  });

  const {
    data: transactions = [],
    isLoading: isTxLoading,
    isFetching: isTxFetching,
  } = useQuery({
    queryKey: [
      "accounts-restaurant-txs",
      restaurantId,
      dateRange.from,
      dateRange.to,
      txType,
    ],
    queryFn: () =>
      fetchRestaurantLedgerTransactions(restaurantId, {
        from: dateRange.from,
        to: dateRange.to,
        type: txType === "all" ? undefined : txType,
        limit: 300,
      }),
    enabled: Boolean(restaurantId),
    placeholderData: keepPreviousData,
  });

  const pdfMutation = useMutation({
    mutationFn: () =>
      downloadRestaurantMonthlyPdf({
        restaurantId,
        year: Number(reportYear),
        month: Number(reportMonth),
      }),
    onSuccess: () => toast.success("PDF downloaded"),
    onError: () => toast.error("Could not download PDF"),
  });

  const restaurant = ledger?.restaurant;
  const summary = ledger?.summary;
  const filtered = Boolean(dateRange.from || dateRange.to);

  if (isLedgerError) {
    return (
      <div className="space-y-4">
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Restaurants
        </Link>
        <p className="text-sm text-red-300">
          {getApiErrorMessage(ledgerError, "Could not load restaurant ledger")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/15"
          onClick={() => void refetchLedger()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Restaurants
        </Link>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isLedgerLoading && !restaurant
                ? "Loading…"
                : restaurant?.name || "Restaurant"}
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Credits, debits &amp; GST · {periodLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {restaurant?.isGstRegistered && restaurant.gstNumber ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-300"
                >
                  GST {restaurant.gstNumber}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 text-amber-300"
                >
                  No GSTIN · GST to platform
                </Badge>
              )}
              {restaurant?.commissionPercent != null ? (
                <Badge
                  variant="outline"
                  className="border-white/20 text-white/60"
                >
                  Commission {restaurant.commissionPercent}%
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-white/40">Year</label>
              <Input
                type="number"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="mt-1 w-24 bg-white/5 border-white/10 text-white h-8"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40">Month</label>
              <Input
                type="number"
                min={1}
                max={12}
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="mt-1 w-20 bg-white/5 border-white/10 text-white h-8"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 text-white/70 h-8"
              disabled={pdfMutation.isPending}
              onClick={() => pdfMutation.mutate()}
            >
              {pdfMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Monthly PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "border-white/15 text-white/60 h-8",
              preset === p.id &&
                "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]",
            )}
            onClick={() => {
              startTransition(() => {
                setPreset(p.id);
                if (p.id !== "custom") {
                  setCustomFrom("");
                  setCustomTo("");
                } else if (!customFrom && !customTo) {
                  const today = toYmd(startOfLocalDay(new Date()));
                  setCustomFrom(today);
                  setCustomTo(today);
                }
              });
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] text-white/40">From</label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label="Available balance"
          value={formatMoney(summary?.availableBalance)}
          loading={isLedgerLoading}
        />
        <MiniStat
          label="Total credits"
          value={formatMoney(summary?.totalCredit)}
          hint={`${summary?.creditCount ?? 0} credits`}
          loading={isLedgerLoading}
        />
        <MiniStat
          label="Total debits"
          value={formatMoney(summary?.totalDebit)}
          hint={`${summary?.debitCount ?? 0} debits / payouts`}
          loading={isLedgerLoading}
        />
        <MiniStat
          label={filtered ? `Gross sales · ${periodLabel}` : "Gross sales"}
          value={formatMoney(
            filtered
              ? (summary?.period?.totalGrossSales ?? summary?.totalGrossSales)
              : summary?.totalGrossSales,
          )}
          hint={`Commission ${formatMoney(
            filtered
              ? (summary?.period?.commissionEarned ?? summary?.commissionEarned)
              : summary?.commissionEarned,
          )}`}
          loading={isLedgerLoading}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniStat
          label={`GST to restaurant · ${periodLabel}`}
          value={formatMoney(
            filtered
              ? (summary?.period?.gstToRestaurant ?? summary?.gstToRestaurant)
              : (summary?.gstToRestaurant ?? summary?.totalGstInWallet),
          )}
          hint={
            restaurant?.isGstRegistered
              ? "Valid GSTIN → restaurant wallet"
              : "Restaurant not GST-registered"
          }
          loading={isLedgerLoading}
        />
        <MiniStat
          label={`GST to platform · ${periodLabel}`}
          value={formatMoney(
            filtered
              ? (summary?.period?.gstToPlatform ?? summary?.gstToPlatform)
              : summary?.gstToPlatform,
          )}
          hint="Retained by PickFoo when restaurant has no valid GSTIN"
          loading={isLedgerLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "credit", label: "Credits" },
            { id: "debit", label: "Debits" },
            { id: "payout", label: "Payouts" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "border-white/15 text-white/60 h-8",
              txType === tab.id &&
                "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]",
            )}
            onClick={() => startTransition(() => setTxType(tab.id))}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        {isTxLoading && transactions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-12 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
            Loading transactions…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/40">When</TableHead>
                  <TableHead className="text-white/40">Type</TableHead>
                  <TableHead className="text-white/40">Order</TableHead>
                  <TableHead className="text-white/40 text-right">Amount</TableHead>
                  <TableHead className="text-white/40 text-right">
                    Gross / GST / Comm
                  </TableHead>
                  <TableHead className="text-white/40">GST to</TableHead>
                  <TableHead className="text-white/40">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-white/35"
                    >
                      No transactions in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const dest = gstDest(tx);
                    return (
                      <TableRow
                        key={tx._id}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell className="text-white/45 text-sm whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              tx.type === "credit"
                                ? "border-[#98E32F]/30 text-[#98E32F]"
                                : tx.type === "debit"
                                  ? "border-red-500/30 text-red-300"
                                  : "border-sky-500/30 text-sky-300"
                            }
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {orderLabel(tx)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-medium",
                            tx.type === "credit"
                              ? "text-[#98E32F]"
                              : "text-red-300",
                          )}
                        >
                          {tx.type === "credit" ? "+" : "−"}
                          {formatMoney(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-white/50 tabular-nums">
                          {formatMoney(tx.grossAmount)}
                          <br />
                          {formatMoney(tx.gstAmount)} /{" "}
                          {formatMoney(tx.commissionAmount)}
                        </TableCell>
                        <TableCell>
                          {dest ? (
                            <Badge
                              variant="outline"
                              className={
                                dest === "restaurant"
                                  ? "border-emerald-500/30 text-emerald-300"
                                  : "border-amber-500/30 text-amber-300"
                              }
                            >
                              {dest === "restaurant" ? "Restaurant" : "Platform"}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-white/40 text-xs">
                          {tx.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {isTxFetching ? (
              <p className="px-4 py-2 text-[11px] text-white/30">Updating…</p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
