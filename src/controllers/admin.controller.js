import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import config from '../config/config.js';
import { buildReminderHtml } from '../jobs/dailyReminder.js';
import { sendEmail } from '../utils/mailer.js';

const ipTracker = new Map();
const ADMIN_SECRET = config.supabase.serviceRoleKey || 'kasflow-secret-fallback';

export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    const tracker = ipTracker.get(ip) || { attempts: 0, blockedUntil: 0 };

    if (tracker.blockedUntil > now) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Akses diblokir karena terlalu banyak percobaan gagal. Silakan coba lagi besok.' 
      });
    } else if (tracker.blockedUntil > 0) {
      tracker.attempts = 0;
      tracker.blockedUntil = 0;
    }

    if (username === 'CCPS090' && password === 'CC26PS090') {
      ipTracker.delete(ip);

      const token = jwt.sign({ role: 'admin', ip }, ADMIN_SECRET, { expiresIn: '1h' });
      const expiresAt = Date.now() + 60 * 60 * 1000;
      
      return res.json({ success: true, token, expiresAt });
    }

    tracker.attempts += 1;
    
    if (tracker.attempts >= 3) {
      tracker.blockedUntil = now + (24 * 60 * 60 * 1000);
      ipTracker.set(ip, tracker);

      try {
        await sendEmail(
          'radzzoffc@gmail.com',
          '🚨 [URGENT] Peringatan Pembobolan Panel Admin KasFlow',
          `<div style="font-family:sans-serif; padding: 20px;">
            <h2 style="color: red;">Peringatan Keamanan</h2>
            <p>Sistem mendeteksi 3 kali kegagalan login berturut-turut pada panel admin KasFlow.</p>
            <ul>
              <li><strong>Waktu Kejadian:</strong> ${new Date().toLocaleString('id-ID')}</li>
              <li><strong>IP Pelaku:</strong> ${ip}</li>
              <li><strong>Tindakan Sistem:</strong> IP tersebut telah otomatis diblokir selama 24 jam.</li>
            </ul>
            <p>Abaikan pesan ini jika ini adalah Anda. Namun jika bukan, segera periksa log server Anda.</p>
          </div>`
        );
      } catch (mailErr) {
      }

      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Percobaan login melebihi batas. IP Anda diblokir sementara.' 
      });
    }

    ipTracker.set(ip, tracker);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: `Username atau password salah. (Sisa percobaan: ${3 - tracker.attempts})` 
    });

  } catch (err) {
    next(err);
  }
}

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token tidak ditemukan atau format salah.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (decoded.role !== 'admin') throw new Error('Role mismatch');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Sesi tidak valid atau telah habis. Silakan login ulang.' });
  }
}

export async function listUsers(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, count: data.length, users: data });
  } catch (err) {
    next(err);
  }
}

export async function sendEmailToUser(req, res, next) {
  try {
    const { email, subject, message, userId } = req.body;

    if (!email && !userId) {
      return res.status(400).json({ error: 'Provide email or userId.' });
    }

    let targetEmail = email;
    let targetName  = 'Pengguna KasFlow';

    if (userId && !email) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single();
      if (error || !data) return res.status(404).json({ error: 'User not found.' });
      targetEmail = data.email;
      targetName  = data.full_name;
    }

    const html = message
      ? buildCustomHtml(targetName, subject, message)
      : buildReminderHtml(targetName);

    await sendEmail(targetEmail, subject || '📩 Pesan dari KasFlow', html);

    res.json({ success: true, message: `Email sent to ${targetEmail}.` });
  } catch (err) {
    next(err);
  }
}

export async function broadcastEmail(req, res, next) {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message are required.' });
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name');
    if (error) throw error;
    if (!users?.length) return res.json({ success: true, sent: 0, total: 0 });

    let sent = 0;
    const failures = [];

    for (const user of users) {
      try {
        await sendEmail(user.email, subject, buildCustomHtml(user.full_name, subject, message));
        sent++;
      } catch (err) {
        failures.push({ email: user.email, error: err.message });
      }
    }

    res.json({ success: true, sent, total: users.length, failures });
  } catch (err) {
    next(err);
  }
}

export async function getGlobalNotifications(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, title, message, type, created_at')
      .order('created_at', { ascending: false });

    if (error && error.code === '42P01') {
      return res.json({ success: true, notifications: [] });
    }
    if (error) throw error;
    res.json({ success: true, count: data.length, notifications: data });
  } catch (err) {
    next(err);
  }
}

export async function createGlobalNotification(req, res, next) {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) {
       return res.status(400).json({ error: 'Title and message are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({ title, message, type: type || 'info' })
      .select()
      .single();

    if (error && error.code === '42P01') {
       return res.status(500).json({ error: 'Table Not Found', message: 'Tabel notifications belum dibuat di Supabase.'});
    }
    if (error) throw error;

    return res.json({ success: true, message: 'Global announcement created', data });
  } catch (err) {
    next(err);
  }
}

export async function updateGlobalNotification(req, res, next) {
  try {
    const { id } = req.params;
    const { title, message, type } = req.body;
    
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ title, message, type })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ success: true, message: 'Announcement updated', data });
  } catch (err) {
    next(err);
  }
}

export async function deleteGlobalNotification(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
}

function buildCustomHtml(name = 'Pengguna KasFlow', subject = '', message = '') {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:24px;">💰 KasFlow</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">${subject}</p>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
        <h2 style="color:#111827;font-size:18px;">Hai, ${name}! 👋</h2>
        <div style="color:#374151;line-height:1.7;white-space:pre-wrap;">${message}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">
          Email ini dikirim oleh tim KasFlow. © ${new Date().getFullYear()} KasFlow – CC26-PS090.
        </p>
      </div>
    </div>
  `;
}
