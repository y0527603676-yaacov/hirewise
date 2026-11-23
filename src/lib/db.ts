import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { cfEnv } from "./cf";
import * as schema from "./schema";

/** Creates the tables. Runs once per server instance and is safe to repeat. */
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, company TEXT, contact_email TEXT, locale TEXT NOT NULL DEFAULT 'en', preferred_currency TEXT NOT NULL DEFAULT 'USD', default_jurisdiction TEXT NOT NULL DEFAULT 'GLOBAL', free_credits INTEGER NOT NULL DEFAULT 2, purchased_credits INTEGER NOT NULL DEFAULT 0, total_used_credits INTEGER NOT NULL DEFAULT 0, locked_evals INTEGER NOT NULL DEFAULT 0, ever_purchased INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_seen_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_tokens (id TEXT PRIMARY KEY, email TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'en', expires_at INTEGER NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS job_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, department TEXT, employment_type TEXT NOT NULL, location_type TEXT NOT NULL, jurisdiction TEXT NOT NULL, responsibilities TEXT NOT NULL, required_skills TEXT NOT NULL, unique_slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'ACTIVE', base_locale TEXT NOT NULL DEFAULT 'en', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS manager_questionnaires (id TEXT PRIMARY KEY, job_profile_id TEXT NOT NULL UNIQUE, pace_of_work TEXT NOT NULL, pressure_level TEXT NOT NULL, autonomy_vs_supervision TEXT NOT NULL, team_dynamics TEXT NOT NULL, critical_traits TEXT NOT NULL, non_negotiables TEXT NOT NULL, behavioral_red_lines TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, job_profile_id TEXT NOT NULL, locale TEXT NOT NULL, is_base INTEGER NOT NULL DEFAULT 0, questions TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(job_profile_id, locale))`,
  `CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, job_profile_id TEXT NOT NULL, full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, locale TEXT NOT NULL, accommodation INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS candidate_submissions (id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, assessment_id TEXT NOT NULL, job_profile_id TEXT NOT NULL, token TEXT NOT NULL UNIQUE, answers TEXT NOT NULL DEFAULT '{}', current_index INTEGER NOT NULL DEFAULT 0, time_spent_seconds INTEGER NOT NULL DEFAULT 0, tab_switch_count INTEGER NOT NULL DEFAULT 0, paste_attempt_count INTEGER NOT NULL DEFAULT 0, briefing_agreed_at INTEGER NOT NULL, started_at INTEGER, completed_at INTEGER, suspicious_activity_flags TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'IN_PROGRESS', eval_status TEXT NOT NULL DEFAULT 'NONE', eval_attempts INTEGER NOT NULL DEFAULT 0, eval_started_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS evaluation_reports (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, overall_score INTEGER NOT NULL, competence_score INTEGER NOT NULL, culture_fit_score INTEGER NOT NULL, reliability_score INTEGER NOT NULL, executive_summary TEXT NOT NULL, strengths TEXT NOT NULL, red_flags TEXT NOT NULL, recommended_interview_questions TEXT NOT NULL, per_question TEXT NOT NULL DEFAULT '[]', integrity TEXT NOT NULL DEFAULT '{}', report_locale TEXT NOT NULL, is_unlocked INTEGER NOT NULL DEFAULT 0, unlock_source TEXT, unlocked_at INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, amount INTEGER NOT NULL, currency TEXT NOT NULL, pack TEXT NOT NULL, credits_added INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', return_key TEXT NOT NULL, process_id TEXT, process_token TEXT, created_at INTEGER NOT NULL, paid_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_user ON job_profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sub_job ON candidate_submissions(job_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sub_eval ON candidate_submissions(eval_status)`,
  `CREATE INDEX IF NOT EXISTS idx_cand_job_email ON candidates(job_profile_id, email)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id)`,
];

/** Later additions to existing tables. Each runs alone; a failure ("column exists") is skipped. */
const MIGRATIONS: string[] = [
  // Partner accounts (a store opened through a partner platform such as TileVision)
  "ALTER TABLE users ADD COLUMN partner TEXT",
  "ALTER TABLE users ADD COLUMN external_id TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_partner_ext ON users(partner, external_id)",
  // Background question writing for roles created through the partner API
  "ALTER TABLE job_profiles ADD COLUMN gen_attempts INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE job_profiles ADD COLUMN gen_started_at INTEGER",
  "ALTER TABLE job_profiles ADD COLUMN role_key TEXT",
];

const g = globalThis as unknown as { __hwSchemaReady?: boolean };

export async function rawDb() {
  const { DB } = await cfEnv();
  if (!g.__hwSchemaReady) {
    await DB.batch(DDL.map((sql) => DB.prepare(sql)));
    for (const sql of MIGRATIONS) await DB.prepare(sql).run().catch(() => {});
    g.__hwSchemaReady = true;
  }
  return DB;
}

export async function getDb() {
  return drizzle((await rawDb()) as never, { schema });
}

export const newId = () => crypto.randomUUID();

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return r?.value ?? null;
}
export async function putSetting(key: string, value: string) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}
export async function delSetting(key: string) {
  const db = await getDb();
  await db.delete(schema.settings).where(eq(schema.settings.key, key));
}
