"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { fetchAccountsExpenses } from "@/lib/api/accounts-hr";
import {
  downloadExcel,
  excelStamp,
  fetchAllPages,
  formatExcelDate,
} from "@/lib/export-excel";
import { getApiErrorMessage } from "@/lib/axios";

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

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AccountsExpensesPage() {
  const ist = useMemo(() => currentIstYearMonth(), []);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState(String(ist.year));
  const [month, setMonth] = useState(String(ist.month));

  const yearNum = Number(year) || ist.year;
  const monthNum = Math.min(12, Math.max(1, Number(month) || ist.month));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["accounts-expenses", page, yearNum, monthNum],
    queryFn: () =>
      fetchAccountsExpenses({
        page,
        limit: DEFAULT_PAGE_SIZE,
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

  const excelMutation = useMutation({
    mutationFn: async () => {
      const exportRows = await fetchAllPages(
        (page, limit) =>
          fetchAccountsExpenses({
            page,
            limit,
            year: yearNum,
            month: monthNum,
          }),
        { limit: 100 },
      );
      downloadExcel({
        filename: `pickfoo-expenses-${excelStamp()}`,
        sheetName: "Expenses",
        columns: [
          { header: "When", value: (r) => formatExcelDate(r.occurredAt) },
          { header: "Tag", value: (r) => r.tag },
          { header: "Party", value: (r) => r.partyName || "" },
          { header: "Amount", value: (r) => Number(r.amount) || 0 },
          { header: "Invoice", value: (r) => r.invoiceRef || "" },
          { header: "Notes", value: (r) => r.notes || "" },
        ],
        rows: exportRows,
      });
      return exportRows.length;
    },
    onSuccess: (count) => toast.success(`Exported ${count} rows to Excel`),
    onError: () => toast.error("Could not export Excel"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-white/45">
            Read-only platform expenses · {monthLabel}
          </p>
        </div>
        <ExportExcelButton
          loading={excelMutation.isPending}
          onClick={() => excelMutation.mutate()}
        />
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

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-300">
              {getApiErrorMessage(error, "Could not load expenses")}
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
            Loading expenses…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/40">When</TableHead>
                    <TableHead className="text-white/40">Tag</TableHead>
                    <TableHead className="text-white/40">Party</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-white/40">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-white/35"
                      >
                        No expenses this month
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-white/5 hover:bg-white/3"
                      >
                        <TableCell className="text-white/60 whitespace-nowrap">
                          {formatDate(row.occurredAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-white/20 text-white/70 capitalize"
                          >
                            {row.tag}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/70">
                          {row.partyName || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-300">
                          −{formatMoney(row.amount)}
                        </TableCell>
                        <TableCell className="max-w-55 truncate text-white/40 text-xs">
                          {row.notes || row.invoiceRef || "—"}
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
