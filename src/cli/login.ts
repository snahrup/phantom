import { loadAdminToken } from "./credentials.ts";

/**
 * Generate a dashboard login link by calling the running Phantom server.
 * Auto-reads the admin token from data/.phantom-credentials if --token is not provided.
 */
export async function runLogin(args: string[]): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		console.log("phantom login - Generate a magic link to sign into the web dashboard\n");
		console.log("Usage: phantom login [--token TOKEN] [--port PORT]\n");
		console.log("Options:");
		console.log("  --token TOKEN   MCP admin token (auto-detected from data/.phantom-credentials)");
		console.log("  --port PORT     Server port (default: 3100)");
		return;
	}

	const tokenIdx = args.indexOf("--token");
	const explicitToken = tokenIdx !== -1 && args[tokenIdx + 1] ? args[tokenIdx + 1] : null;
	const token = explicitToken ?? loadAdminToken();

	const portIdx = args.indexOf("--port");
	const port = portIdx !== -1 && args[portIdx + 1] ? args[portIdx + 1] : "3100";

	if (!token) {
		console.error("Error: No admin token found.");
		console.error("Either pass --token or create one with: phantom token create --client admin --scope admin");
		process.exit(1);
	}

	if (!explicitToken) {
		console.log("Using saved admin token from data/.phantom-credentials");
	}

	const baseUrl = `http://localhost:${port}`;

	// Call the MCP endpoint to invoke phantom_generate_login tool
	try {
		// First initialize an MCP session
		const initRes = await fetch(`${baseUrl}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "initialize",
				params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "phantom-cli", version: "1.0" } },
				id: 1,
			}),
		});

		if (!initRes.ok) {
			console.error(`Error: Server returned ${initRes.status}. Is Phantom running on port ${port}?`);
			process.exit(1);
		}

		const sessionId = initRes.headers.get("mcp-session-id");

		// Call the generate login tool
		const toolRes = await fetch(`${baseUrl}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
				...(sessionId ? { "mcp-session-id": sessionId } : {}),
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				method: "tools/call",
				params: { name: "phantom_generate_login", arguments: {} },
				id: 2,
			}),
		});

		const result = await toolRes.json() as { result?: { content?: Array<{ text?: string }> } };
		const text = result?.result?.content?.[0]?.text;
		if (text) {
			const data = JSON.parse(text);
			console.log("Dashboard login link (expires in 10 minutes):\n");
			console.log(`  ${data.magicLink}\n`);
			console.log("Open this URL in your browser to sign in.");
		} else {
			console.error("Error: Unexpected response from server");
			console.error(JSON.stringify(result, null, 2));
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes("ECONNREFUSED")) {
			console.error(`Error: Cannot connect to Phantom on port ${port}. Is it running?`);
		} else {
			console.error(`Error: ${msg}`);
		}
		process.exit(1);
	}
}
