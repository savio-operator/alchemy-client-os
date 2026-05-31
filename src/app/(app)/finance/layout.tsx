import { FinanceNav } from "@/components/finance-nav";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <FinanceNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
