import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '../config/supabase.js';
import config from '../config/config.js';

export function createTransporter() {
  return nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

export function buildReminderHtml(name = 'Pengguna KasFlow') {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:24px;">KasFlow</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
        <h2 style="color:#111827;font-size:18px;">Hai, ${name}! 👋</h2>
        <p style="color:#6b7280;line-height:1.6;">
          Jangan lupa catat transaksi keuangan kamu hari ini.
          Mencatat secara rutin membantu kamu memantau arus kas dan membuat keputusan yang lebih baik bagi kesejahteraan finansial masa depan.
        </p>
        <a href="${config.app.frontendUrl}/transactions/new"
          style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;
                 border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
          Catat Sekarang →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          Email ini dikirim otomatis oleh sistem KasFlow. Jika kamu sudah mencatat hari ini, mohon abaikan pesan ini.
        </p>
      </div>
    </div>
  `;
}

export async function sendReminderEmail(transporter, email, fullName) {
  return transporter.sendMail({
    from:    config.smtp.from,
    to:      email,
    subject: '🔔 Jangan lupa catat transaksi hari ini – KasFlow',
    html:    buildReminderHtml(fullName),
  });
}

export const runDailyReminder = async () => {
  const today = new Date().toISOString().split('T')[0];

  const { data: allUsers, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name');
  if (userErr) throw userErr;
  if (!allUsers?.length) return { sent: 0, total: 0 };

  const { data: activeTx, error: txErr } = await supabaseAdmin
    .from('transactions')
    .select('user_id')
    .eq('date', today);
  if (txErr) throw txErr;

  const activeUserIds = new Set((activeTx || []).map((t) => t.user_id));
  const usersToRemind = allUsers.filter((u) => !activeUserIds.has(u.id));

  if (!usersToRemind.length) return { sent: 0, total: 0 };

  const transporter = createTransporter();
  let sent = 0;

  for (const user of usersToRemind) {
    try {
      await sendReminderEmail(transporter, user.email, user.full_name);
      sent++;
      console.log(`[cron] Reminder sent → ${user.email}`);
    } catch (err) {
      console.error(`[cron] Failed to send → ${user.email}: ${err.message}`);
    }
  }

  console.log(`[cron] Daily reminder done: ${sent}/${usersToRemind.length} emails sent.`);
  return { sent, total: usersToRemind.length };
};

export function startDailyReminderCron() {
  cron.schedule('0 3 * * *', async () => {
    console.log(`[cron] Running daily reminder (10:00 WIB) – ${new Date().toISOString()}`);
    try {
      const result = await runDailyReminder();
      console.log(`[cron] Result:`, result);
    } catch (err) {
      console.error('[cron] Error in daily reminder:', err.message);
    }
  }, {
    timezone: 'UTC',
  });

  console.log('[cron] Daily reminder scheduled - 10:00 WIB (03:00 UTC)');
}
