"use client";

import { startTransition, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { fetchAccountsOrders } from "@/lib/api/accounts-entities";
import { getApiErrorMessage } from "@/lib/axios";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const;

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

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>("last_7_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("all");

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
      "accounts-orders",
      page,
      dateRange.from,
      dateRange.to,
      status,
    ],
    queryFn: () =>
      fetchAccountsOrders({
        page,
        limit: DEFAULT_PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        status: status === "all" ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-white/45">
          Order totals, commission credits, and GST split · {periodLabel}
        </p>
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
              preset === p.id && "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]",
            )}
            onClick={() => {
              startTransition(() => {
                setPreset(p.id);
                setPage(1);
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
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 bg-white/5 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40">To</label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label="Orders"
          value={String(summary?.total ?? 0)}
          hint={`${summary?.delivered ?? 0} delivered · ${summary?.cancelled ?? 0} cancelled`}
          loading={isLoading}
        />
        <MiniStat
          label="Platform commission"
          value={formatMoney(summary?.platformCommission)}
          hint={`Avg ${formatMoney(summary?.averageCommission)}`}
          loading={isLoading || isFetching}
        />
        <MiniStat
          label="Active"
          value={String(summary?.active ?? 0)}
          loading={isLoading}
        />
        <MiniStat
          label="Commissionable"
          value={String(summary?.commissionableOrders ?? 0)}
          loading={isLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              "border-white/15 text-white/60 h-8",
              status === tab.id &&
                "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F]",
            )}
            onClick={() => {
              startTransition(() => {
                setStatus(tab.id);
                setPage(1);
              });
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-300">
              {getApiErrorMessage(error, "Could not load orders")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </div>
        ) : isLoading && !data ? (
          <div className="flex items-center justify-center gap-2 p-12 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin text-[#98E32F]" />
            Loading orders…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/40">Order</TableHead>
                    <TableHead className="text-white/40">Restaurant</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40 text-right">Total</TableHead>
                    <TableHead className="text-white/40 text-right">GST</TableHead>
                    <TableHead className="text-white/40">GST to</TableHead>
                    <TableHead className="text-white/40 text-right">Commission</TableHead>
                    <TableHead className="text-white/40">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-white/35"
                      >
                        No orders in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-white/5 hover:bg-white/[0.03]"
                      >
                        <TableCell className="font-medium">
                          {row.pickfooId || row.id.slice(-6)}
                          {row.deliveryPartnerName ? (
                            <p className="text-[11px] text-white/35 font-normal">
                              {row.deliveryPartnerName}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-white/70">
                          {row.restaurantName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-white/20 text-white/70 capitalize"
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-white/70">
                          {formatMoney(row.gstAmount)}
                          {(row.cgstAmount || row.sgstAmount) ? (
                            <p className="text-[10px] text-white/35">
                              C {formatMoney(row.cgstAmount)} · S{" "}
                              {formatMoney(row.sgstAmount)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              row.gstDestination === "restaurant"
                                ? "border-emerald-500/30 text-emerald-300"
                                : "border-amber-500/30 text-amber-300"
                            }
                          >
                            {row.gstDestination === "restaurant"
                              ? "Restaurant"
                              : "Platform"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[#98E32F]">
                          {formatMoney(row.platformCommission)}
                        </TableCell>
                        <TableCell className="text-white/45 text-sm whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ListPagination
              page={data?.page ?? page}
              total={data?.total ?? 0}
              totalPages={data?.totalPages}
              limit={data?.limit ?? DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
