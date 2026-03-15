import { supabaseAnon, supabaseAdmin } from '../config/supabase.js';
import config from '../config/config.js';

const FRONTEND_URL = config.app.frontendUrl;

const DEFAULT_CATEGORIES = [
  { name: 'Penjualan Produk',   type: 'income',  icon: 'shopping-cart', color: '#22c55e', is_default: true },
  { name: 'Jasa / Layanan',     type: 'income',  icon: 'wrench',        color: '#10b981', is_default: true },
  { name: 'Investasi',          type: 'income',  icon: 'trending-up',   color: '#06b6d4', is_default: true },
  { name: 'Pendapatan Lainnya', type: 'income',  icon: 'dollar-sign',   color: '#84cc16', is_default: true },
  { name: 'Bahan Baku',         type: 'expense', icon: 'package',       color: '#ef4444', is_default: true },
  { name: 'Gaji Karyawan',      type: 'expense', icon: 'users',         color: '#f97316', is_default: true },
  { name: 'Sewa Tempat',        type: 'expense', icon: 'home',          color: '#eab308', is_default: true },
  { name: 'Listrik & Air',      type: 'expense', icon: 'zap',           color: '#f59e0b', is_default: true },
  { name: 'Transportasi',       type: 'expense', icon: 'truck',         color: '#8b5cf6', is_default: true },
  { name: 'Marketing & Iklan',  type: 'expense', icon: 'megaphone',     color: '#ec4899', is_default: true },
  { name: 'Pengeluaran Lainnya',type: 'expense', icon: 'credit-card',   color: '#6b7280', is_default: true },
];

async function seedDefaultCategories(userId) {
  const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId }));
  await supabaseAdmin.from('categories').upsert(rows, {
    onConflict: 'user_id,name,type',
    ignoreDuplicates: true,
  });
}

async function upsertUser(user) {
  const { id, email, user_metadata } = user;
  const fullName  = user_metadata?.full_name || user_metadata?.name || null;
  const avatarUrl = user_metadata?.avatar_url || user_metadata?.picture || null;

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  const isNew = !existing;

  await supabaseAdmin.from('users').upsert(
    { id, email, full_name: fullName, avatar_url: avatarUrl },
    { onConflict: 'id' }
  );

  if (isNew) await seedDefaultCategories(id);

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  return userRow;
}

export const googleOAuth = async (_req, res) => {
  const { data, error } = await supabaseAnon.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${FRONTEND_URL}/auth/callback` },
  });
  if (error) return res.status(500).json({ error: 'OAuthError', message: error.message });
  return res.redirect(data.url);
};

export const githubOAuth = async (_req, res) => {
  const { data, error } = await supabaseAnon.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${FRONTEND_URL}/auth/callback` },
  });
  if (error) return res.status(500).json({ error: 'OAuthError', message: error.message });
  return res.redirect(data.url);
};

export const oauthCallback = async (_req, res) => {
  return res.redirect(`${FRONTEND_URL}/auth/callback`);
};
export const oauthImplicitCallback = async (req, res) => {
  const { access_token, refresh_token, expires_in } = req.query;
  if (!access_token) {
    return res.status(400).json({ error: 'BadRequest', message: 'Missing access_token' });
  }

  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ error: 'OAuthError', message: error?.message || 'Invalid token' });
    }

    try { await upsertUser(user); } catch (dbErr) { console.error('[auth/implicit-callback] upsertUser:', dbErr.message); }

    const backendHost  = req.hostname;
    const frontendHost = new URL(FRONTEND_URL).hostname;
    if (frontendHost !== backendHost) {
      const redirectUrl = new URL('/auth/callback', FRONTEND_URL);
      redirectUrl.searchParams.set('access_token',  access_token);
      redirectUrl.searchParams.set('refresh_token', refresh_token || '');
      redirectUrl.searchParams.set('expires_in',    expires_in   || '3600');
      return res.redirect(redirectUrl.toString());
    }

    return res.json({
      data: {
        access_token,
        refresh_token: refresh_token || null,
        expires_in:    Number(expires_in) || 3600,
        user: {
          id:         user.id,
          email:      user.email,
          full_name:  user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.user.id);

    if (authUser?.user) {
      try { await upsertUser(authUser.user); } catch (_) {}
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, avatar_url, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
};

export const logout = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await supabaseAnon.auth.admin?.signOut(token).catch(() => {});
  return res.json({ message: 'Logged out successfully' });
};
