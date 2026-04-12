// src/controllers/gamification.controller.js
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  ensureGamificationRow,
  ensureTodayMissions,
  getFinancialHealthScore,
  getLevelFromXp,
  getXpForNextLevel,
  checkAndUnlockBadges,
} from '../services/gamification.service.js';

// ─────────────────────────────────────────────────────────
// GET /api/v1/gamification/summary
// Mengembalikan: level, xp, streak, financial health score
// ─────────────────────────────────────────────────────────
export async function getSummary(req, res, next) {
  try {
    const userId = req.user.id;

    // Pastikan row gamifikasi ada
    const gamRow = await ensureGamificationRow(userId);

    // Hitung financial health score
    const healthScore = await getFinancialHealthScore(userId);

    // Cek badge berdasarkan skor finansial (realtime)
    await checkAndUnlockBadges(userId, { financialScore: healthScore });

    const level          = gamRow.level;
    const xp             = gamRow.xp;
    const xpForNext      = getXpForNextLevel(level);

    // XP yang dibutuhkan untuk level ini (batas bawah)
    const xpForCurrent   = level > 1 ? getXpForNextLevel(level - 1) : 0;
    const xpProgress     = xp - xpForCurrent;
    const xpNeeded       = xpForNext !== null ? xpForNext - xpForCurrent : null;

    // Label level sesuai UI (sesuaikan kalau frontend beda)
    const levelNames = [
      '', // index 0 kosong
      'Pemula Finansial',
      'Paham Finansial',
      'Bisa Finansial',
      'Cakap Finansial',
      'Ahli Finansial',
      'Master Finansial',
    ];

    const healthLabel =
      healthScore >= 80 ? 'Sangat Sehat' :
      healthScore >= 60 ? 'Cukup Sehat' :
      healthScore >= 40 ? 'Perlu Perhatian' : 'Kritis';

    return res.json({
      data: {
        level: {
          current:    level,
          name:       levelNames[level] ?? `Level ${level}`,
          xp_current: xp,
          xp_progress: xpProgress,
          xp_needed:  xpNeeded,
          xp_for_next: xpForNext,
        },
        streak: {
          days:            gamRow.streak_days,
          last_activity:   gamRow.last_activity_date,
        },
        financial_health: {
          score: healthScore,
          label: healthLabel,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/v1/gamification/badges
// Mengembalikan semua badge + status unlock user
// ─────────────────────────────────────────────────────────
export async function getBadges(req, res, next) {
  try {
    const userId = req.user.id;

    // Semua badge yang ada
    const { data: allBadges, error: bErr } = await supabaseAdmin
      .from('badges')
      .select('*')
      .order('type')
      .order('threshold');
    if (bErr) return next(bErr);

    // Badge yang dimiliki user
    const { data: userBadges, error: uErr } = await supabaseAdmin
      .from('user_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId);
    if (uErr) return next(uErr);

    // Jumlah total transaksi user (untuk progress bar badge transaksi)
    const { count: txCount } = await supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const gamRow = await ensureGamificationRow(userId);

    const unlockedMap = new Map(userBadges.map(b => [b.badge_id, b.unlocked_at]));

    const badges = allBadges.map(badge => {
      const unlocked    = unlockedMap.has(badge.id);
      const unlockedAt  = unlockedMap.get(badge.id) ?? null;

      // Hitung progress untuk tiap tipe badge
      let current = 0;
      switch (badge.type) {
        case 'transaction':     current = txCount ?? 0; break;
        case 'level':           current = gamRow.level; break;
        case 'streak':          current = gamRow.streak_days; break;
        case 'financial_health': current = 0; break; // dihitung terpisah di summary
      }

      return {
        id:          badge.id,
        key:         badge.key,
        name:        badge.name,
        description: badge.description,
        icon:        badge.icon,
        color:       badge.color,
        type:        badge.type,
        threshold:   badge.threshold,
        unlocked,
        unlocked_at: unlockedAt,
        progress: {
          current: Math.min(current, badge.threshold),
          target:  badge.threshold,
        },
      };
    });

    return res.json({ data: badges });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/v1/gamification/missions
// Mengembalikan misi harian + progress hari ini
// ─────────────────────────────────────────────────────────
export async function getMissions(req, res, next) {
  try {
    const userId = req.user.id;
    const today  = new Date().toISOString().split('T')[0];

    // Pastikan misi hari ini sudah di-seed untuk user ini
    await ensureTodayMissions(userId);

    // Ambil misi + status hari ini
    const { data: userMissions, error } = await supabaseAdmin
      .from('user_daily_missions')
      .select(`
        id,
        completed,
        completed_at,
        daily_missions (
          id,
          key,
          title,
          description,
          xp_reward,
          type
        )
      `)
      .eq('user_id', userId)
      .eq('date', today);

    if (error) return next(error);

    // Hitung streak untuk label "N Hari Beruntun"
    const gamRow = await ensureGamificationRow(userId);

    const missions = userMissions.map(um => ({
      id:          um.id,
      mission_id:  um.daily_missions.id,
      key:         um.daily_missions.key,
      title:       um.daily_missions.title,
      description: um.daily_missions.description,
      xp_reward:   um.daily_missions.xp_reward,
      type:        um.daily_missions.type,
      completed:   um.completed,
      completed_at: um.completed_at,
    }));

    return res.json({
      data: {
        date:         today,
        streak_days:  gamRow.streak_days,
        missions,
        completed_count: missions.filter(m => m.completed).length,
        total_count:     missions.length,
      },
    });
  } catch (err) {
    next(err);
  }
}