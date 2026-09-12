import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createAdminClient();

  const shopId = '9ba07a9c-3ef7-4de8-a632-03680c38ca9d'; // ครัวป้าแดง

  const riderConfigs = [
    {
      email: 'rider1.kruapa@gmail.com',
      password: 'RiderPass1234!',
      display_name: 'สมชาย ขี่เร็ว',
      phone: '0891112233',
      vehicle_type: 'motorcycle',
    },
    {
      email: 'rider2.kruapa@gmail.com',
      password: 'RiderPass1234!',
      display_name: 'วิชัย บริการดี',
      phone: '0894445566',
      vehicle_type: 'motorcycle',
    },
  ];

  console.log('=== STEP 3: CREATING & VERIFYING 2 PILOT RIDERS ===\n');

  for (const config of riderConfigs) {
    console.log(`--- Setting up Rider: ${config.display_name} (${config.email}) ---`);

    // 1. Create or retrieve Supabase Auth User
    let authUserId: string;
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === config.email.toLowerCase());

    if (existing) {
      console.log(`Auth user already exists: ${existing.id}`);
      authUserId = existing.id;
      // Update password to ensure known credentials
      await admin.auth.admin.updateUserById(authUserId, { password: config.password });
    } else {
      const { data: newUser, error: createAuthErr } = await admin.auth.admin.createUser({
        email: config.email,
        password: config.password,
        email_confirm: true,
        user_metadata: {
          role: 'rider',
          shop_id: shopId,
          display_name: config.display_name,
        },
      });

      if (createAuthErr || !newUser?.user) {
        throw new Error(`Failed to create auth user: ${createAuthErr?.message}`);
      }
      authUserId = newUser.user.id;
      console.log(`Created new Supabase Auth user: ${authUserId}`);
    }

    // 2. Create or retrieve public.riders row
    const { data: existingRider } = await admin
      .from('riders')
      .select('id, auth_user_id, display_name, phone, status, push_enabled')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    let riderId: string;
    if (existingRider) {
      console.log(`Rider row already exists: ${existingRider.id}`);
      riderId = existingRider.id;
      await admin
        .from('riders')
        .update({
          shop_id: shopId,
          display_name: config.display_name,
          phone: config.phone,
          status: 'active',
          push_enabled: true,
        })
        .eq('id', riderId);
    } else {
      const { data: newRider, error: insertErr } = await admin
        .from('riders')
        .insert({
          shop_id: shopId,
          auth_user_id: authUserId,
          display_name: config.display_name,
          phone: config.phone,
          vehicle_type: config.vehicle_type,
          status: 'active',
          push_enabled: true,
          performance_score: 5.0,
        })
        .select('id')
        .single();

      if (insertErr || !newRider) {
        throw new Error(`Failed to insert rider: ${insertErr?.message}`);
      }
      riderId = newRider.id;
      console.log(`Created public.riders row: ${riderId}`);
    }

    // 3. Test Login via Supabase Client (simulating /rider/login)
    console.log(`Testing login at /rider/login for ${config.email}...`);
    const riderClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data: loginData, error: loginErr } = await riderClient.auth.signInWithPassword({
      email: config.email,
      password: config.password,
    });

    if (loginErr || !loginData?.session) {
      throw new Error(`Login failed for ${config.email}: ${loginErr?.message}`);
    }
    console.log(`✅ Login SUCCESS! Token received for user: ${loginData.user.id}`);

    // 4. Test Start Work Session
    console.log(`Testing start work session for rider ${riderId}...`);
    // First close any dangling open session
    await riderClient.rpc('close_rider_work_session', {});

    const { data: sessionData, error: sessionErr } = await riderClient
      .from('rider_work_sessions')
      .insert({
        rider_id: riderId,
        shop_id: shopId,
        status: 'open',
      })
      .select('id, started_at')
      .single();

    if (sessionErr || !sessionData) {
      throw new Error(`Start session failed: ${sessionErr?.message}`);
    }
    console.log(`✅ Work session STARTED: session_id=${sessionData.id}`);

    // 5. Test Close Work Session
    console.log(`Testing close work session for session ${sessionData.id}...`);
    const { data: closeData, error: closeErr } = await riderClient.rpc('close_rider_work_session', {
      p_session_id: sessionData.id,
    });

    if (closeErr) {
      throw new Error(`Close session failed: ${closeErr?.message}`);
    }
    console.log(`✅ Work session CLOSED successfully:`, closeData);
    console.log(`---------------------------------------------------\n`);
  }

  // Final verification from DB
  const { data: allRiders, error: verifyErr } = await admin
    .from('riders')
    .select('id, auth_user_id, display_name, phone, status, push_enabled')
    .eq('shop_id', shopId);

  if (verifyErr) throw verifyErr;
  console.log('Final verified riders for Krua Pa Daeng in DB:');
  console.table(allRiders);

  console.log('✅ Step 3 Complete: 2 Pilot Riders created, mapped, logged in, and verified sessions!');
}

main().catch((err) => {
  console.error('Step 3 Error:', err);
  process.exit(1);
});
