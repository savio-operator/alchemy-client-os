/**
 * MCP Client — connects to external MCP servers via JSON-RPC over HTTP.
 */

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPServerInfo {
  name: string;
  version: string;
}

interface MCPInitializeResult {
  protocolVersion: string;
  serverInfo: MCPServerInfo;
  capabilities: Record<string, unknown>;
}

export class MCPClient {
  private url: string = "";
  private apiKey?: string;
  private requestId = 0;
  private serverInfo: MCPServerInfo | null = null;

  async connect(url: string, apiKey?: string): Promise<MCPInitializeResult> {
    this.url = url;
    this.apiKey = apiKey;

    const result = await this.rpc<MCPInitializeResult>("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "adchemy-client-os", version: "1.0.0" },
      capabilities: {},
    });

    this.serverInfo = result.serverInfo;
    return result;
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.rpc<{ tools: MCPTool[] }>("tools/list", {});
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await this.rpc("tools/call", { name, arguments: args });
    return result;
  }

  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  private async rpc<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!this.url) {
      throw new Error("MCPClient not connected. Call connect() first.");
    }

    this.requestId++;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: this.requestId,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
    }

    return data.result as T;
  }
}
