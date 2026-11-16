"use client";

import { startTransition, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
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
  fetchPartnerLedger,
  fetchPartnerLedgerTransactions,
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

export default function PartnerLedgerPage() {
  const params = useParams();
  const partnerId = String(params.id || "");
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");

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
    queryKey: ["accounts-partner-ledger", partnerId],
    queryFn: () => fetchPartnerLedger(partnerId),
    enabled: Boolean(partnerId),
  });

  const {
    data: transactions = [],
    isLoading: isTxLoading,
    isFetching: isTxFetching,
  } = useQuery({
    queryKey: [
      "accounts-partner-txs",
      partnerId,
      dateRange.from,
      dateRange.to,
      direction,
    ],
    queryFn: () =>
      fetchPartnerLedgerTransactions(partnerId, {
        from: dateRange.from,
        to: dateRange.to,
        direction: direction === "all" ? undefined : direction,
        limit: 300,
      }),
    enabled: Boolean(partnerId),
    placeholderData: keepPreviousData,
  });

  const partner = ledger?.partner;
  const summary = ledger?.summary;

  if (isLedgerError) {
    return (
      <div className="space-y-4">
        <Link
          href="/partners"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Partners
        </Link>
        <p className="text-sm text-red-300">
          {getApiErrorMessage(ledgerError, "Could not load partner ledger")}
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
          href="/partners"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Partners
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {isLedgerLoading && !partner
            ? "Loading…"
            : partner?.fullName || "Partner"}
        </h1>
        <p className="mt-1 text-sm text-white/45">
          Credits &amp; debits · {periodLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {partner?.status ? (
            <Badge variant="outline" className="border-white/20 text-white/60">
              {partner.status}
            </Badge>
          ) : null}
          {partner?.phone ? (
            <Badge variant="outline" className="border-white/20 text-white/60">
              {partner.phone}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label="Available balance"
          value={formatMoney(summary?.availableBalance)}
          loading={isLedgerLoading}
        />
        <MiniStat
          label="Total credits"
          value={formatMoney(summary?.totalCredits)}
          hint={`Lifetime ${formatMoney(summary?.lifetimeEarnings)}`}
          loading={isLedgerLoading}
        />
        <MiniStat
          label="Total debits"
          value={formatMoney(summary?.totalDebits)}
          hint={`Pending withdrawal ${formatMoney(summary?.pendingWithdrawal)}`}
          loading={isLedgerLoading}
        />
        <MiniStat
          label="This week"
          value={formatMoney(summary?.weekEarnings)}
          hint={`${summary?.tripCount ?? 0} trips · tips ${formatMoney(summary?.tipsTotal)}`}
          loading={isLedgerLoading}
        />
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

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "credit", label: "Credits" },
            { id: "debit", label: "Debits" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "border-white/15 text-white/60 h-8",
              direction === tab.id &&
                "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]",
            )}
            onClick={() => startTransition(() => setDirection(tab.id))}
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
                  <TableHead className="text-white/40">Direction</TableHead>
                  <TableHead className="text-white/40">Order</TableHead>
                  <TableHead className="text-white/40 text-right">Amount</TableHead>
                  <TableHead className="text-white/40">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-white/35"
                    >
                      No transactions in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow
                      key={tx._id}
                      className="border-white/5 hover:bg-white/[0.03]"
                    >
                      <TableCell className="text-white/45 text-sm whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                      <TableCell className="capitalize text-white/70">
                        {String(tx.type || "").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            tx.direction === "credit"
                              ? "border-[#98E32F]/30 text-[#98E32F]"
                              : "border-red-500/30 text-red-300"
                          }
                        >
                          {tx.direction}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.pickfooId || "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          tx.direction === "credit"
                            ? "text-[#98E32F]"
                            : "text-red-300",
                        )}
                      >
                        {tx.direction === "credit" ? "+" : "−"}
                        {formatMoney(tx.amount)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-white/40 text-xs">
                        {tx.meta?.note ||
                          tx.meta?.purpose ||
                          tx.meta?.trigger ||
                          "—"}
                      </TableCell>
                    </TableRow>
                  ))
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
