const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
const envLine = fs
  .readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith('DATABASE_URL='));

if (!envLine) throw new Error('DATABASE_URL is missing from .env.local');

const connectionString = envLine.trim().slice('DATABASE_URL='.length);

async function verify() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const grants = await client.query(`
      select
        not has_function_privilege(
          'anon', 'public.respond_to_dispatch_offer(uuid,text)', 'execute'
        ) as anon_offer_blocked,
        has_function_privilege(
          'authenticated', 'public.respond_to_dispatch_offer(uuid,text)', 'execute'
        ) as rider_rpc_allowed,
        not has_function_privilege(
          'authenticated', 'public.create_daily_settlement_draft(uuid,date)', 'execute'
        ) as settlement_locked
    `);

    const policies = await client.query(`
      select count(*)::integer as forbidden_policies
      from pg_policies
      where policyname in (
        'Rider can respond to own offers',
        'Rider can insert own delivery events',
        'Rider can insert own POD',
        'Rider can read own shop POD',
        'Shop staff can read POD'
      )
    `);

    const indexes = await client.query(`
      select to_regclass('public.uq_rider_one_open_work_session') is not null
        as session_race_guard
    `);

    const concurrency = await client.query(`
      select
        pg_get_functiondef(
          'public.respond_to_dispatch_offer(uuid,text)'::regprocedure
        ) ilike '%pg_advisory_xact_lock%' as offer_rider_lock,
        pg_get_functiondef(
          'public.close_rider_work_session(uuid)'::regprocedure
        ) ilike '%pg_advisory_xact_lock%' as close_session_rider_lock
    `);

    const checks = {
      ...grants.rows[0],
      forbidden_policies: policies.rows[0].forbidden_policies,
      ...indexes.rows[0],
      ...concurrency.rows[0],
    };

    if (
      !checks.anon_offer_blocked ||
      !checks.rider_rpc_allowed ||
      !checks.settlement_locked ||
      checks.forbidden_policies !== 0 ||
      !checks.session_race_guard ||
      !checks.offer_rider_lock ||
      !checks.close_session_rider_lock
    ) {
      throw new Error(`Rider P0 database verification failed: ${JSON.stringify(checks)}`);
    }

    console.log('Rider P0 database verification passed.');
  } finally {
    await client.end();
  }
}

verify().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
