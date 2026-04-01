/**
 * Local credential storage for the admin MCP token.
 * Stored in data/.phantom-credentials (gitignored via data/).
 * This avoids the operator having to dig up the token on every login.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CREDENTIALS_PATH = join(process.cwd(), "data", ".phantom-credentials");

export function saveAdminToken(token: string): void {
	const dir = dirname(CREDENTIALS_PATH);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(CREDENTIALS_PATH, token, "utf-8");
}

export function loadAdminToken(): string | null {
	if (!existsSync(CREDENTIALS_PATH)) return null;
	const token = readFileSync(CREDENTIALS_PATH, "utf-8").trim();
	return token || null;
}
