"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  fetchPartnerAdjustments,
  type PartnerAdjustmentPurpose,
} from "@/lib/api/accounts-ledger";
import { getApiErrorMessage } from "@/lib/axios";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const PURPOSE_TABS: Array<{ id: PartnerAdjustmentPurpose; label: string }> = [
  { id: "all", label: "All adjustments" },
  { id: "partner_incentive", label: "Partner bonuses" },
  { id: "refund_clawback", label: "Refund clawbacks" },
  { id: "admin_adjustment", label: "Admin adjustments" },
  { id: "restaurant_transfer", label: "Restaurant transfers" },
];

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

function purposeLabel(purpose: string) {
  switch (purpose) {
    case "partner_bonus":
    case "partner_incentive":
      return "Partner bonus";
    case "refund_clawback":
      return "Refund clawback";
    case "restaurant_transfer":
      return "Restaurant transfer";
    default:
      return purpose.replace(/_/g, " ");
  }
}

export default function AdjustmentsPage() {
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [purpose, setPurpose] = useState<PartnerAdjustmentPurpose>("all");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

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

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      "partner-adjustments",
      page,
      dateRange.from,
      dateRange.to,
      purpose,
      direction,
      debouncedSearch,
    ],
    queryFn: () =>
      fetchPartnerAdjustments({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        purpose,
        direction: direction === "all" ? undefined : direction,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        <p className="text-sm text-white/60">Loading partner adjustments…</p>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-white">
        <p className="text-sm text-red-300">
          {getApiErrorMessage(error, "Could not load partner adjustments")}
        </p>
        <Button
          type="button"
          size="sm"
          className="bg-[#98E32F] text-[#013644] hover:bg-[#98E32F]/90"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-(family-name:--font-fraunces)">
          Partner adjustments
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Partner bonus credits, refund clawbacks, admin adjustments, and
          restaurant→partner transfers. Read-only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/10 bg-white/5 text-white gap-0 py-0">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Credits · {periodLabel}
            </p>
            <p className="mt-1 text-xl font-bold text-[#98E32F]">
              {formatMoney(summary?.totalCredits)}
            </p>
            <p className="text-[11px] text-white/35 mt-1">
              {summary?.creditCount ?? 0} entries
            </p>
          </div>
        </Card>
        <Card className="border-white/10 bg-white/5 text-white gap-0 py-0">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Debits · {periodLabel}
            </p>
            <p className="mt-1 text-xl font-bold text-red-300">
              {formatMoney(summary?.totalDebits)}
            </p>
            <p className="text-[11px] text-white/35 mt-1">
              {summary?.debitCount ?? 0} entries
            </p>
          </div>
        </Card>
        <Card className="border-white/10 bg-white/5 text-white gap-0 py-0">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              Net · {periodLabel}
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatMoney(summary?.net)}
            </p>
          </div>
        </Card>
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

      <div className="flex flex-wrap gap-2 items-center">
        {PURPOSE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              startTransition(() => {
                setPurpose(tab.id);
                setPage(1);
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs border transition-colors",
              purpose === tab.id
                ? "border-[#98E32F]/40 bg-[#98E32F]/15 text-[#98E32F]"
                : "border-white/10 text-white/50 hover:border-white/25",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "credit", "debit"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              startTransition(() => {
                setDirection(d);
                setPage(1);
              });
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs border transition-colors capitalize",
              direction === d
                ? "border-[#98E32F]/40 bg-[#98E32F]/15 text-[#98E32F]"
                : "border-white/10 text-white/50 hover:border-white/25",
            )}
          >
            {d}
          </button>
        ))}
        <Input
          placeholder="Search partner / note"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-8 w-56 border-white/15 bg-black/20 text-white ml-auto"
        />
        {isFetching && !isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#98E32F]" />
        ) : null}
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">When</TableHead>
              <TableHead className="text-white/50">Purpose</TableHead>
              <TableHead className="text-white/50">Dir</TableHead>
              <TableHead className="text-white/50">Partner</TableHead>
              <TableHead className="text-white/50">Note</TableHead>
              <TableHead className="text-white/50 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#98E32F] mx-auto" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-white/40"
                >
                  No adjustments for this filter
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-white/5">
                  <TableCell className="text-white/70 text-xs">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {purposeLabel(row.purpose)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.direction === "credit"
                          ? "border-[#98E32F]/30 bg-[#98E32F]/15 text-[#98E32F]"
                          : "border-red-500/30 bg-red-500/15 text-red-300"
                      }
                    >
                      {row.direction}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.partnerName || "—"}</div>
                    <div className="text-[11px] text-white/35">
                      {row.partnerPhone || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-white/50 max-w-55 truncate">
                    {row.note || row.pickfooId || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(row.amount)}
                  </TableCell>
                </TableRow>
              ))
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
    </div>
  );
}
