"use client";

import { startTransition, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { fetchAccountsEmployees } from "@/lib/api/accounts-hr";
import { getApiErrorMessage } from "@/lib/axios";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function currentIstYearMonth() {
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

function formatMoney(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return money.format(n);
}

export default function AccountsEmployeesPage() {
  const ist = useMemo(() => currentIstYearMonth(), []);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [year, setYear] = useState(String(ist.year));
  const [month, setMonth] = useState(String(ist.month));

  const yearNum = Number(year) || ist.year;
  const monthNum = Math.min(12, Math.max(1, Number(month) || ist.month));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["accounts-employees", page, search, status, yearNum, monthNum],
    queryFn: () =>
      fetchAccountsEmployees({
        page,
        limit: DEFAULT_PAGE_SIZE,
        search: search.trim() || undefined,
        status,
        year: yearNum,
        month: monthNum,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-white/45">
          Read-only staff salaries · paid status for {monthLabel}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
        <Input
          placeholder="Search name / phone / role"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm bg-white/5 border-white/10 text-white"
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
              { id: "all", label: "All" },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 border-white/15 text-white/60",
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
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[11px] text-white/40">Year</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-24 bg-white/5 border-white/10 text-white h-8"
            />
          </div>
          <div>
            <label className="text-[11px] text-white/40">Month</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-20 bg-white/5 border-white/10 text-white h-8"
            />
          </div>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-300">
              {getApiErrorMessage(error, "Could not load employees")}
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
            Loading employees…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/40">Employee</TableHead>
                    <TableHead className="text-white/40">Role</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Monthly salary
                    </TableHead>
                    <TableHead className="text-white/40">{monthLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-white/35"
                      >
                        No employees
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-white/5 hover:bg-white/3"
                      >
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <p className="text-[11px] text-white/35">
                            {[row.phone, row.email].filter(Boolean).join(" · ") ||
                              "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {row.role || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.monthlySalary)}
                        </TableCell>
                        <TableCell>
                          {row.salaryMonth?.paid ? (
                            <Badge
                              variant="outline"
                              className="border-[#98E32F]/30 text-[#98E32F]"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Paid{" "}
                              {formatMoney(row.salaryMonth.payment?.amount)}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 text-amber-300"
                            >
                              Unpaid
                            </Badge>
                          )}
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
