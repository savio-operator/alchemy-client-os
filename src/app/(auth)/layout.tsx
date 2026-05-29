import { cookies } from "next/headers";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force dynamic rendering — static prerender can cause stale RSC errors
  await cookies();
  return <>{children}</>;
}
