/**
 * RAN-R-HAN Telegram bot setup (registration script, run manually).
 *
 * Reads everything from the environment — never hardcode tokens here.
 * Required env:
 *   TELEGRAM_BOT_TOKEN      bot token from BotFather (rotated, never committed)
 *   TELEGRAM_WEBHOOK_SECRET random secret compared against
 *                           the x-telegram-bot-api-secret-token header
 * Optional env:
 *   TELEGRAM_WEBHOOK_URL    full https URL of /api/telegram/webhook.
 *                           Omit to skip (re)registration and only verify.
 *   TELEGRAM_BOT_USERNAME   used for the deep-link hint only
 *
 * This script never touches production data. Registering a webhook URL
 * changes where Telegram delivers updates, so only run it against the
 * environment you intend (staging first, production only with approval).
 */
const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const webhookUrl = (process.env.TELEGRAM_WEBHOOK_URL || '').trim();
const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'ranrhan_bot').trim();

if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set. Refusing to continue.');
  process.exit(1);
}
if (!webhookSecret) {
  console.error('ERROR: TELEGRAM_WEBHOOK_SECRET is not set. Refusing to continue.');
  process.exit(1);
}

async function callApi(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json();
  // Never log the token or the secret.
  console.log(`${method}:`, JSON.stringify({ ok: data.ok, description: data.description || null }));
  if (!data.ok) {
    throw new Error(`${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

async function setup() {
  // 0. Verify the token first (read-only).
  const me = await callApi('getMe');
  console.log(`Bot identity: @${me.username} (id ${me.id})`);

  // 1. setMyDescription
  await callApi('setMyDescription', {
    description:
      'RAN-R-HAN operational gateway: order updates, rider offers, shop alerts. Verify with /start, then use the menu. Thai/English.',
  });

  // 2. setMyShortDescription
  await callApi('setMyShortDescription', {
    short_description: 'RAN-R-HAN gateway: orders, riders, shops, settlement alerts',
  });

  // 3. setMyCommands (bot-wide defaults; role menus are sent per chat after verify)
  await callApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'Verify identity and open the menu' },
      { command: 'menu', description: 'Show my role menu again' },
      { command: 'account', description: 'Show my verified identity and roles' },
      { command: 'unlink', description: 'Revoke this Telegram account link' },
      { command: 'help', description: 'Help and support' },
    ],
  });

  // 4. Webhook registration — only when an explicit URL is provided.
  if (webhookUrl) {
    await callApi('setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
      max_connections: 40,
      allowed_updates: ['message', 'callback_query'],
    });
  } else {
    console.log('TELEGRAM_WEBHOOK_URL not set — skipping webhook registration.');
  }

  // 5. Read-only report of the current registration (never mutates).
  const info = await callApi('getWebhookInfo');
  console.log(
    'Webhook info:',
    JSON.stringify({
      url: info.url || null,
      pending_update_count: info.pending_update_count ?? null,
      last_error_message: info.last_error_message || null,
    })
  );
}

setup().catch((err) => {
  console.error('Setup failed:', err.message || err);
  process.exit(1);
});
