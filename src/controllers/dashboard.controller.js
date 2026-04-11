import { supabaseAdmin } from '../config/supabase.js';

export const getSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const startDate = `${y}-${m}-01`;
    const lastDay   = new Date(y, Number(m), 0).getDate();
    const endDate   = `${y}-${m}-${lastDay}`;

    const [{ data: monthTx }, { data: allTx }] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('type, amount')
        .eq('profile_id', req.profile.id)
        .gte('date', startDate)
        .lte('date', endDate),
      supabaseAdmin
        .from('transactions')
        .select('type, amount')
        .eq('profile_id', req.profile.id),
    ]);

    const totalIncome  = (monthTx || []).filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
    const totalExpense = (monthTx || []).filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
    const balance      = (allTx   || []).reduce((s, r) => s + (r.type === 'income' ? Number(r.amount) : -Number(r.amount)), 0);

    return res.json({
      data: {
        profile:           { id: req.profile.id, name: req.profile.name, type: req.profile.type },
        period:            { month: m, year: y, startDate, endDate },
        total_income:      totalIncome,
        total_expense:     totalExpense,
        profit_loss:       totalIncome - totalExpense,
        transaction_count: (monthTx || []).length,
        balance,
      },
    });
  } catch (err) {
    next(err);
  }
};

const WIB_OFFSET = 7;

function nowWIB() {
  const utc = new Date();
  return new Date(utc.getTime() + WIB_OFFSET * 60 * 60 * 1000);
}

function toDateStr(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}


function getMondayOf(dateStr) {
  const [y, m, dd] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dow + 1);
  return d;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                      'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export const getChart = async (req, res, next) => {
  try {
    const weeks = Math.min(Number(req.query.weeks) || 12, 24);

    const todayWIB   = nowWIB();
    const todayStr   = toDateStr(todayWIB);
    const curMonday  = getMondayOf(todayStr);
    const startMonday = new Date(curMonday);
    startMonday.setUTCDate(startMonday.getUTCDate() - ((weeks - 1) * 7));
    const sinceStr = toDateStr(startMonday);

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, date')
      .eq('profile_id', req.profile.id)
      .gte('date', sinceStr)
      .order('date', { ascending: true });

    if (error) throw error;

    const grouped = {};
    for (let w = 0; w < weeks; w++) {
      const wk = new Date(startMonday);
      wk.setUTCDate(wk.getUTCDate() + (w * 7));

      const key    = toDateStr(wk);
      const dayStr = String(wk.getUTCDate()).padStart(2, '0');
      const monStr = MONTH_LABELS[wk.getUTCMonth()];

      grouped[key] = { income: 0, expense: 0, period: `${dayStr} ${monStr}` };
    }

    for (const row of data || []) {
      if (!row.date) continue;
      const key = toDateStr(getMondayOf(row.date));
      if (grouped[key]) {
        if (row.type === 'income')  grouped[key].income  += Number(row.amount);
        if (row.type === 'expense') grouped[key].expense += Number(row.amount);
      }
    }

    const result = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        period:      v.period,
        income:      v.income,
        expense:     v.expense,
        profit_loss: v.income - v.expense,
      }));

    return res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getRecentTransactions = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('profile_id', req.profile.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data || []).map(({ categories: cat, ...t }) => ({
      ...t,
      category_name:  cat?.name  ?? null,
      category_icon:  cat?.icon  ?? null,
      category_color: cat?.color ?? null,
    }));

    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

export const getTopCategories = async (req, res, next) => {
  try {
    const { type = 'expense', month, year } = req.query;
    const now = new Date();
    const m = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const startDate = `${y}-${m}-01`;
    const lastDay   = new Date(y, Number(m), 0).getDate();
    const endDate   = `${y}-${m}-${lastDay}`;

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('amount, category_id, categories(id, name, icon, color)')
      .eq('profile_id', req.profile.id)
      .eq('type', type)
      .gte('date', startDate)
      .lte('date', endDate)
      .not('category_id', 'is', null);

    if (error) throw error;
    const catMap = {};
    for (const row of data || []) {
      const cat = row.categories;
      if (!cat) continue;
      if (!catMap[cat.id]) catMap[cat.id] = { ...cat, total: 0, count: 0 };
      catMap[cat.id].total += Number(row.amount);
      catMap[cat.id].count += 1;
    }

    const result = Object.values(catMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return res.json({ data: result });
  } catch (err) {
    next(err);
  }
};
