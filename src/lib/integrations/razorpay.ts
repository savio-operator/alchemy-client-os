import Razorpay from "razorpay";

function getClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw new Error("Razorpay credentials not configured");

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// --- Payments ---

export async function listPayments(options?: {
  from?: number;
  to?: number;
  count?: number;
  skip?: number;
}) {
  const client = getClient();
  const params: Record<string, number> = {};
  if (options?.from) params.from = options.from;
  if (options?.to) params.to = options.to;
  if (options?.count) params.count = options.count;
  if (options?.skip) params.skip = options.skip;

  const payments = await client.payments.all(params);
  return payments;
}

export async function getPayment(paymentId: string) {
  const client = getClient();
  return client.payments.fetch(paymentId);
}

// --- Subscriptions ---

export async function listSubscriptions() {
  const client = getClient();
  return client.subscriptions.all();
}

export async function getSubscription(subscriptionId: string) {
  const client = getClient();
  return client.subscriptions.fetch(subscriptionId);
}

// --- Invoices ---

export async function listInvoices(options?: {
  count?: number;
  skip?: number;
}) {
  const client = getClient();
  const params: Record<string, number> = {};
  if (options?.count) params.count = options.count;
  if (options?.skip) params.skip = options.skip;

  return client.invoices.all(params);
}

// --- Summary ---

export async function getRevenueSummary(fromDate?: Date, toDate?: Date) {
  const now = new Date();
  const from = fromDate || new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
  const to = toDate || now;

  const payments = await listPayments({
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(to.getTime() / 1000),
    count: 100,
  });

  const items = payments.items || [];
  const captured = items.filter((p) => p.status === "captured");
  const totalRevenue = captured.reduce(
    (sum: number, p) => sum + (Number(p.amount) || 0),
    0
  );
  const totalCount = captured.length;

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    totalRevenue: totalRevenue / 100, // paise to INR
    totalPayments: totalCount,
    currency: "INR",
  };
}
