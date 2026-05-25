const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getHeaders() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not configured");

  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export function isNotionConfigured(): boolean {
  return !!process.env.NOTION_API_KEY;
}

export async function queryDatabase(databaseId: string, filter?: object) {
  const body: Record<string, unknown> = {};
  if (filter) body.filter = filter;

  const res = await fetch(`${NOTION_BASE_URL}/databases/${databaseId}/query`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion queryDatabase failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function getPage(pageId: string) {
  const res = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion getPage failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function getPageContent(blockId: string) {
  const res = await fetch(
    `${NOTION_BASE_URL}/blocks/${blockId}/children?page_size=100`,
    {
      method: "GET",
      headers: getHeaders(),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion getPageContent failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function createPage(
  parentId: string,
  properties: object,
  children?: object[]
) {
  const body: Record<string, unknown> = {
    parent: { page_id: parentId },
    properties,
  };
  if (children) body.children = children;

  const res = await fetch(`${NOTION_BASE_URL}/pages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion createPage failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function updatePage(pageId: string, properties: object) {
  const res = await fetch(`${NOTION_BASE_URL}/pages/${pageId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion updatePage failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function searchNotion(query: string) {
  const res = await fetch(`${NOTION_BASE_URL}/search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ query, page_size: 20 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion search failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function appendBlockChildren(blockId: string, children: object[]) {
  const res = await fetch(`${NOTION_BASE_URL}/blocks/${blockId}/children`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ children }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Notion appendBlockChildren failed: ${res.status} ${err?.message || res.statusText}`
    );
  }

  return res.json();
}

export async function getFinanceSummary() {
  const pageId = process.env.NOTION_FINANCE_PAGE_ID;
  if (!pageId) throw new Error("NOTION_FINANCE_PAGE_ID is not configured");

  const [page, content] = await Promise.all([
    getPage(pageId),
    getPageContent(pageId),
  ]);

  return { page, content };
}

export async function getReportPage() {
  const pageId = process.env.NOTION_REPORT_PAGE_ID;
  if (!pageId) throw new Error("NOTION_REPORT_PAGE_ID is not configured");

  const [page, content] = await Promise.all([
    getPage(pageId),
    getPageContent(pageId),
  ]);

  return { page, content };
}
