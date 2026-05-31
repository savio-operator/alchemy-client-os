"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/finance", label: "Dashboard", exact: true },
  { href: "/finance/entries", label: "Entries" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/yearly", label: "Yearly" },
  { href: "/finance/advisor", label: "Advisor" },
  { href: "/finance/parse", label: "Parse" },
  { href: "/finance/reports", label: "Reports" },
  { href: "/finance/setup", label: "Setup" },
];

export function FinanceNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-[var(--accent-clay)] text-white"
                : "text-[var(--ink-muted)] hover:bg-[var(--muted)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
