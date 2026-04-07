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

export const getChart = async (req, res, next) => {
  try {
    const months = Math.min(Number(req.query.months) || 6, 12);
    const since  = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, date')
      .eq('profile_id', req.profile.id)
      .gte('date', sinceStr)
      .order('date', { ascending: true });

    if (error) throw error;

    const grouped = {};
    for (const row of data || []) {
      const key = row.date.substring(0, 7);
      if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
      if (row.type === 'income')  grouped[key].income  += Number(row.amount);
      if (row.type === 'expense') grouped[key].expense += Number(row.amount);
    }

    const result = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
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
