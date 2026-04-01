import type { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAGIC_LINK_TTL_MS = 10 * 60 * 1000; // 10 minutes

let db: Database | null = null;

export function setSessionDb(database: Database): void {
	db = database;
	// Purge expired rows on startup
	const now = Date.now();
	db.run("DELETE FROM ui_sessions WHERE expires_at < ?", [now]);
	db.run("DELETE FROM ui_magic_links WHERE expires_at < ?", [now]);
}

export function createSession(): { sessionToken: string; magicToken: string } {
	const sessionToken = randomBytes(32).toString("base64url");
	const magicToken = randomBytes(24).toString("base64url");
	const now = Date.now();

	if (db) {
		db.run("INSERT INTO ui_sessions (token, created_at, expires_at) VALUES (?, ?, ?)", [
			sessionToken,
			now,
			now + SESSION_TTL_MS,
		]);
		db.run("INSERT INTO ui_magic_links (token, session_token, expires_at, used) VALUES (?, ?, ?, 0)", [
			magicToken,
			sessionToken,
			now + MAGIC_LINK_TTL_MS,
		]);
	}

	return { sessionToken, magicToken };
}

export function isValidSession(token: string): boolean {
	if (!db) return false;
	const now = Date.now();
	const row = db.query("SELECT token FROM ui_sessions WHERE token = ? AND expires_at > ?").get(token, now) as {
		token: string;
	} | null;
	if (!row) {
		// Clean up expired entry if it existed
		db.run("DELETE FROM ui_sessions WHERE token = ?", [token]);
		return false;
	}
	return true;
}

export function consumeMagicLink(magicToken: string): string | null {
	if (!db) return null;
	const now = Date.now();
	const row = db
		.query("SELECT session_token FROM ui_magic_links WHERE token = ? AND used = 0 AND expires_at > ?")
		.get(magicToken, now) as { session_token: string } | null;

	if (!row) {
		db.run("DELETE FROM ui_magic_links WHERE token = ?", [magicToken]);
		return null;
	}

	db.run("DELETE FROM ui_magic_links WHERE token = ?", [magicToken]);
	return row.session_token;
}

export function revokeAllSessions(): void {
	if (!db) return;
	db.run("DELETE FROM ui_sessions");
	db.run("DELETE FROM ui_magic_links");
}

export function getSessionCount(): number {
	if (!db) return 0;
	const now = Date.now();
	const row = db.query("SELECT COUNT(*) as count FROM ui_sessions WHERE expires_at > ?").get(now) as {
		count: number;
	};
	return row.count;
}

export function getMagicLinkCount(): number {
	if (!db) return 0;
	const now = Date.now();
	const row = db
		.query("SELECT COUNT(*) as count FROM ui_magic_links WHERE used = 0 AND expires_at > ?")
		.get(now) as { count: number };
	return row.count;
}
