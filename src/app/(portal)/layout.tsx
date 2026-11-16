"use client";

import { useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, Wallet, Gift } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

const NAV = [
  { name: "Platform ledger", href: "/", icon: Wallet },
  { name: "Partner adjustments", href: "/adjustments", icon: Gift },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isInitialized, initialize, logout, connectionError } =
    useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated && !connectionError) {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, connectionError, router]);

  if (!isInitialized || (!isAuthenticated && !connectionError)) {
    return (
      <div className="h-dvh bg-[#013644] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
        <p className="text-sm text-white/50">Loading accounts…</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="h-dvh bg-[#013644] flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-white/70">Could not reach the API. Check your connection.</p>
        <button
          type="button"
          className="text-[#98E32F] underline"
          onClick={() => void initialize()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-[#013644] text-white overflow-hidden">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:h-dvh md:w-56 md:flex-col border-r border-white/5 bg-[#002833]">
        <div className="p-5 border-b border-white/5 shrink-0">
          <div className="relative h-8 w-28">
            <Image src="/logo.png" alt="Pickfoo" fill className="object-contain" />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#98E32F] font-semibold">
            Accounts
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#98E32F]/15 text-[#98E32F]"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-2 shrink-0">
          <p className="text-xs text-white/50 truncate">{user?.name || "Accountant"}</p>
          <p className="text-[11px] text-white/30 truncate">{user?.phone}</p>
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex h-dvh flex-col min-w-0 md:pl-56">
        <header className="md:hidden shrink-0 flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 bg-[#002833]">
          <div className="relative h-7 w-24">
            <Image src="/logo.png" alt="Pickfoo" fill className="object-contain" />
          </div>
          <div className="flex gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))
                    ? "bg-[#98E32F]/15 text-[#98E32F]"
                    : "text-white/50",
                )}
              >
                {item.name.split(" ")[0]}
              </Link>
            ))}
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
