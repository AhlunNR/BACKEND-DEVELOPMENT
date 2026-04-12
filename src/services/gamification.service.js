// src/services/gamification.service.js
import { supabaseAdmin } from '../config/supabase.js';

// ─── KONSTANTA ────────────────────────────────────────────
// XP yang didapat per aksi
export const XP_REWARDS = {
  transaction_created: 20,
  mission_completed:   0,   // diambil dari tabel daily_missions.xp_reward
  goal_updated:        30,
};

// XP threshold per level (index = level, value = XP total untuk naik ke level berikutnya)
// Level 1 → 2 butuh 200 XP, Level 2 → 3 butuh 500 XP, dst.
const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1800, 3000, 5000, 8000, 12000, 18000, 25000];

export function getLevelFromXp(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function getXpForNextLevel(currentLevel) {
  return LEVEL_THRESHOLDS[currentLevel] ?? null; // null = max level
}

// ─── INIT: pastikan row user_gamification ada ─────────────
export async function ensureGamificationRow(userId) {
  const { data, error } = await supabaseAdmin
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // Buat row baru kalau belum ada
  const { data: created, error: createError } = await supabaseAdmin
    .from('user_gamification')
    .insert({ user_id: userId, xp: 0, level: 1, streak_days: 0 })
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

// ─── TAMBAH XP ────────────────────────────────────────────
export async function addXp(userId, amount, reason) {
  const row = await ensureGamificationRow(userId);
  const newXp = row.xp + amount;
  const newLevel = getLevelFromXp(newXp);

  const { error } = await supabaseAdmin
    .from('user_gamification')
    .update({ xp: newXp, level: newLevel })
    .eq('user_id', userId);

  if (error) throw error;

  // Catat ke xp_history
  await supabaseAdmin
    .from('xp_history')
    .insert({ user_id: userId, amount, reason });

  // Cek badge level
  await checkAndUnlockBadges(userId, { xp: newXp, level: newLevel });

  return { xp: newXp, level: newLevel };
}

// ─── UPDATE STREAK ────────────────────────────────────────
export async function updateStreak(userId) {
  const row = await ensureGamificationRow(userId);
  const today = new Date().toISOString().split('T')[0];
  const last = row.last_activity_date;

  let newStreak = row.streak_days;

  if (!last) {
    newStreak = 1;
  } else {
    const lastDate = new Date(last);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Sudah update hari ini, tidak perlu update streak
      return row.streak_days;
    } else if (diffDays === 1) {
      newStreak = row.streak_days + 1;
    } else {
      // Streak putus
      newStreak = 1;
    }
  }

  const { error } = await supabaseAdmin
    .from('user_gamification')
    .update({ streak_days: newStreak, last_activity_date: today })
    .eq('user_id', userId);

  if (error) throw error;

  // Cek badge streak
  await checkAndUnlockBadges(userId, { streak: newStreak });

  return newStreak;
}

// ─── CEK & UNLOCK BADGE ───────────────────────────────────
export async function checkAndUnlockBadges(userId, context = {}) {
  // Ambil semua badge
  const { data: allBadges, error: bErr } = await supabaseAdmin
    .from('badges')
    .select('*');
  if (bErr) throw bErr;

  // Badge yang sudah dimiliki user
  const { data: owned, error: oErr } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);
  if (oErr) throw oErr;

  const ownedIds = new Set(owned.map(b => b.badge_id));

  // Ambil data yang dibutuhkan untuk pengecekan
  let transactionCount = null;
  let financialScore = null;

  if (context.transactionCount !== undefined) {
    transactionCount = context.transactionCount;
  }
  if (context.financialScore !== undefined) {
    financialScore = context.financialScore;
  }

  const toUnlock = [];

  for (const badge of allBadges) {
    if (ownedIds.has(badge.id)) continue; // sudah punya, skip

    let shouldUnlock = false;

    switch (badge.type) {
      case 'transaction':
        if (transactionCount === null) {
          // Fetch hanya jika belum ada di context
          const { count } = await supabaseAdmin
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);
          transactionCount = count ?? 0;
        }
        shouldUnlock = transactionCount >= badge.threshold;
        break;

      case 'level':
        if (context.level !== undefined) {
          shouldUnlock = context.level >= badge.threshold;
        }
        break;

      case 'streak':
        if (context.streak !== undefined) {
          shouldUnlock = context.streak >= badge.threshold;
        }
        break;

      case 'financial_health':
        // Untuk badge ini, financial score dihitung di getFinancialHealthScore
        // dan dikirim via context kalau ada
        if (financialScore !== null && financialScore >= badge.threshold) {
          shouldUnlock = true;
        }
        break;
    }

    if (shouldUnlock) toUnlock.push({ user_id: userId, badge_id: badge.id });
  }

  if (toUnlock.length > 0) {
    await supabaseAdmin
      .from('user_badges')
      .upsert(toUnlock, { onConflict: 'user_id, badge_id', ignoreDuplicates: true });
  }

  return toUnlock.length;
}

// ─── HITUNG FINANCIAL HEALTH SCORE (0–100) ────────────────
export async function getFinancialHealthScore(userId) {
  // Ambil semua profil user
  const { data: profiles } = await supabaseAdmin
    .from('financial_profiles')
    .select('id')
    .eq('user_id', userId);

  if (!profiles || profiles.length === 0) return 50; // default

  const profileIds = profiles.map(p => p.id);

  // Transaksi 30 hari terakhir
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];

  const { data: txs } = await supabaseAdmin
    .from('transactions')
    .select('type, amount')
    .in('profile_id', profileIds)
    .gte('date', startDate);

  if (!txs || txs.length === 0) return 50;

  const totalIncome  = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  // Komponen skor:
  // 1. Rasio expense/income (40 poin) — semakin kecil semakin baik
  let ratioScore = 40;
  if (totalIncome > 0) {
    const ratio = totalExpense / totalIncome;
    if (ratio <= 0.5)       ratioScore = 40;
    else if (ratio <= 0.7)  ratioScore = 30;
    else if (ratio <= 0.9)  ratioScore = 20;
    else if (ratio <= 1.0)  ratioScore = 10;
    else                    ratioScore = 0;  // boros, pengeluaran > pemasukan
  } else {
    ratioScore = 20; // tidak ada income, netral
  }

  // 2. Konsistensi mencatat transaksi (30 poin)
  const txCount = txs.length;
  let consistencyScore = 0;
  if (txCount >= 20)      consistencyScore = 30;
  else if (txCount >= 10) consistencyScore = 20;
  else if (txCount >= 5)  consistencyScore = 10;

  // 3. Ada goals aktif (15 poin)
  const { count: goalCount } = await supabaseAdmin
    .from('goals')
    .select('id', { count: 'exact', head: true })
    .in('profile_id', profileIds);
  const goalScore = (goalCount ?? 0) > 0 ? 15 : 0;

  // 4. Streak (15 poin)
  const { data: gamRow } = await supabaseAdmin
    .from('user_gamification')
    .select('streak_days')
    .eq('user_id', userId)
    .maybeSingle();
  const streak = gamRow?.streak_days ?? 0;
  let streakScore = 0;
  if (streak >= 14)      streakScore = 15;
  else if (streak >= 7)  streakScore = 10;
  else if (streak >= 3)  streakScore = 5;

  const total = ratioScore + consistencyScore + goalScore + streakScore;
  return Math.min(100, total);
}

// ─── COMPLETE DAILY MISSION ───────────────────────────────
export async function completeMission(userId, missionKey) {
  const today = new Date().toISOString().split('T')[0];

  // Cari mission definition
  const { data: mission, error: mErr } = await supabaseAdmin
    .from('daily_missions')
    .select('*')
    .eq('key', missionKey)
    .maybeSingle();

  if (mErr || !mission) return null;

  // Upsert user_daily_missions
  const { data: existing } = await supabaseAdmin
    .from('user_daily_missions')
    .select('*')
    .eq('user_id', userId)
    .eq('mission_id', mission.id)
    .eq('date', today)
    .maybeSingle();

  if (existing?.completed) return null; // sudah selesai hari ini

  const { error: uErr } = await supabaseAdmin
    .from('user_daily_missions')
    .upsert({
      user_id:      userId,
      mission_id:   mission.id,
      date:         today,
      completed:    true,
      completed_at: new Date().toISOString(),
    }, { onConflict: ['user_id', 'mission_id', 'date'] });

  if (uErr) throw uErr;

  // Beri XP sesuai misi
  await addXp(userId, mission.xp_reward, `mission_completed:${missionKey}`);

  return mission;
}

// ─── ENSURE DAILY MISSIONS ROW ADA UNTUK HARI INI ─────────
export async function ensureTodayMissions(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data: allMissions } = await supabaseAdmin
    .from('daily_missions')
    .select('*');

  if (!allMissions || allMissions.length === 0) return;

  // Cek misi yang sudah ada hari ini
  const { data: existing } = await supabaseAdmin
    .from('user_daily_missions')
    .select('mission_id')
    .eq('user_id', userId)
    .eq('date', today);

  const existingIds = new Set((existing ?? []).map(e => e.mission_id));

  const toInsert = allMissions
    .filter(m => !existingIds.has(m.id))
    .map(m => ({
      user_id:    userId,
      mission_id: m.id,
      date:       today,
      completed:  false,
    }));

  if (toInsert.length > 0) {
    await supabaseAdmin
      .from('user_daily_missions')
      .upsert(toInsert, { onConflict: 'user_id, mission_id, date', ignoreDuplicates: true });
  }
}