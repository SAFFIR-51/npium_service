import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Account } from "../account";
import { prescriptionForDate } from "../workflow";
import { emptyState } from "../repo/empty";
import type { CareState } from "../repo/types";
type Statement = { get(...params: (string | number)[]): Record<string, unknown> | undefined; all(...params: (string | number)[]): Record<string, unknown>[]; run(...params: (string | number)[]): unknown };
type Database = { exec(sql: string): void; prepare(sql: string): Statement };
let connection: Database | undefined;
export function db() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") throw new Error("서버 모드를 설정해 주세요.");
  if (!connection) {
    const file = resolve(/* turbopackIgnore: true */ process.env.NPIUM_DB_PATH || ".local/npium.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    connection = new DatabaseSync(file);
    connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, organization TEXT NOT NULL DEFAULT '', providerId TEXT NOT NULL DEFAULT '', salt TEXT NOT NULL, hash TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, accountId TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS care (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, accountId TEXT NOT NULL, command TEXT NOT NULL, revision INTEGER NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS login_limits (username TEXT PRIMARY KEY, failures INTEGER NOT NULL, untilMs INTEGER NOT NULL);
    `);
    connection.prepare("INSERT OR IGNORE INTO care VALUES(1,0,?)").run(JSON.stringify(emptyState));
  }
  return connection;
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function accountFrom(row: Record<string, unknown>): Account { return { id: String(row.id), username: String(row.username), name: String(row.name), role: row.role as Account["role"], organization: String(row.organization), providerId: String(row.providerId) }; }
export function sessionAccount(request: Request): Account | null {
  const token = /(?:^|;\s*)npium_session=([^;]+)/.exec(request.headers.get("cookie") || "")?.[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db().prepare("SELECT a.* FROM accounts a JOIN sessions s ON s.accountId=a.id WHERE s.token=? AND s.expires>? AND a.disabled=0").get(tokenHash(token), Date.now());
  return row ? accountFrom(row) : null;
}
export function login(username: string, password: string) {
  const d = db(), now = Date.now();
  const limit = d.prepare("SELECT * FROM login_limits WHERE username=?").get(username);
  if (limit && Number(limit.untilMs) > now && Number(limit.failures) >= 5) return null;
  const row = d.prepare("SELECT * FROM accounts WHERE username=? AND disabled=0").get(username);
  const salt = row ? String(row.salt) : "0".repeat(32);
  const candidate = scryptSync(password, salt, 64);
  if (!row || !timingSafeEqual(candidate, Buffer.from(String(row.hash), "hex"))) {
    const failures = limit && Number(limit.untilMs) > now ? Number(limit.failures) + 1 : 1;
    d.prepare("INSERT OR REPLACE INTO login_limits VALUES(?,?,?)").run(username, failures, now + 15 * 60_000); return null;
  }
  d.prepare("DELETE FROM login_limits WHERE username=?").run(username);
  d.prepare("DELETE FROM sessions WHERE expires<?").run(now);
  const token = randomBytes(32).toString("hex");
  d.prepare("INSERT INTO sessions VALUES(?,?,?)").run(tokenHash(token), String(row.id), now + 12 * 60 * 60_000);
  return { account: accountFrom(row), token };
}
export function readState(): { revision: number; state: CareState } {
  const row = db().prepare("SELECT * FROM care WHERE id=1").get()!;
  const state: CareState = JSON.parse(String(row.body)), today = new Date().toLocaleDateString("sv-SE");
  state.patients = state.patients.map(p => { const v = prescriptionForDate(state, p, today); return v ? { ...p, prescription: v.prescription, precautions: v.precautions, doctor: v.prescription.doctor, activePrescriptionVersionId: v.id } : p; });
  return { revision: Number(row.revision), state };
}
export function createAccount(input: Account & { password: string }) {
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(input.username) || input.password.length < 12 || input.password.length > 128 || !input.name.trim() || !["admin", "hospital", "center", "provider", "patient"].includes(input.role) || (input.role === "hospital" || input.role === "center") && !input.organization.trim() || input.role === "provider" && !readState().state.registeredProviders.some(p => p.id === input.providerId)) throw new Error("계정 항목을 확인해 주세요. 비밀번호는 12자 이상입니다.");
  const salt = randomBytes(16).toString("hex"), hash = scryptSync(input.password, salt, 64).toString("hex");
  db().prepare("INSERT INTO accounts(id,username,name,role,organization,providerId,salt,hash) VALUES(?,?,?,?,?,?,?,?)").run(input.id, input.username, input.name.trim(), input.role, input.organization.trim(), input.providerId, salt, hash);
}
