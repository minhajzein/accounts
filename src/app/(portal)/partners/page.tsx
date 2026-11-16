"use client";

import { startTransition, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Search, Wallet } from "lucide-react";
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
import { fetchAccountsPartners } from "@/lib/api/accounts-entities";
import { getApiErrorMessage } from "@/lib/axios";

export default function PartnersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("VERIFIED");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["accounts-partners", page, debouncedSearch, status],
    queryFn: () =>
      fetchAccountsPartners({
        page,
        limit: DEFAULT_PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
        <p className="mt-1 text-sm text-white/45">
          Open a partner to view credits and debits
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone…"
            className="pl-9 bg-white/5 border-white/10 text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "", label: "All" },
            { id: "VERIFIED", label: "Verified" },
            { id: "PENDING", label: "Pending" },
            { id: "ONBOARDING", label: "Onboarding" },
            { id: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <Button
              key={tab.id || "all"}
              type="button"
              size="sm"
              variant="outline"
              className={
                status === tab.id
                  ? "border-[#98E32F]/40 bg-[#98E32F]/10 text-[#98E32F] h-8"
                  : "border-white/15 text-white/60 h-8"
              }
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
      </div>

      <Card className="border-white/10 bg-white/5 text-white gap-0 py-0 overflow-hidden">
        {isError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-300">
              {getApiErrorMessage(error, "Could not load partners")}
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
            Loading partners…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/40">Partner</TableHead>
                    <TableHead className="text-white/40">Status</TableHead>
                    <TableHead className="text-white/40 text-right">
                      Delivered
                    </TableHead>
                    <TableHead className="text-white/40 text-right">Ledger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-white/35"
                      >
                        No partners found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row._id}
                        className="border-white/5 hover:bg-white/3"
                      >
                        <TableCell>
                          <Link
                            href={`/partners/${row._id}`}
                            className="font-medium text-white hover:text-[#98E32F]"
                          >
                            {row.fullName}
                          </Link>
                          <p className="text-[11px] text-white/35">
                            {row.phone || "—"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-white/20 text-white/70"
                          >
                            {row.status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-white/70">
                          {row.deliveredOrderCount ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/15 text-white/70 h-8"
                          >
                            <Link href={`/partners/${row._id}`}>
                              <Wallet className="h-3.5 w-3.5 mr-1.5" />
                              View
                            </Link>
                          </Button>
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
