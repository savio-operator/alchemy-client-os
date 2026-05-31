"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

export default function InvoiceDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/finance/invoices/${id}`);
  }, [id, router]);
  return null;
}
