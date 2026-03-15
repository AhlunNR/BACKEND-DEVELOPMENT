import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { extractReceiptData } from '../utils/ocr.js';
import { uploadToCatbox } from '../utils/catbox.js';

export const getTransactions = async (req, res, next) => {
  try {
    const { type, category_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let q = supabaseAdmin
      .from('transactions')
      .select('*, categories(name, icon, color)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (type && ['income', 'expense'].includes(type)) q = q.eq('type', type);
    if (category_id) q = q.eq('category_id', category_id);
    if (start_date)  q = q.gte('date', start_date);
    if (end_date)    q = q.lte('date', end_date);

    const { data, error, count } = await q;
    if (error) throw error;

    const rows = (data || []).map(({ categories: cat, ...t }) => ({
      ...t,
      category_name:  cat?.name  ?? null,
      category_icon:  cat?.icon  ?? null,
      category_color: cat?.color ?? null,
    }));

    return res.json({
      data: rows,
      pagination: {
        page:       Number(page),
        limit:      Number(limit),
        total:      count ?? 0,
        totalPages: Math.ceil((count ?? 0) / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getTransaction = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return next(new AppError('Transaction not found', 404, 'NotFound'));

    const { categories: cat, ...t } = data;
    return res.json({
      data: { ...t, category_name: cat?.name ?? null, category_icon: cat?.icon ?? null, category_color: cat?.color ?? null },
    });
  } catch (err) {
    next(err);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const { category_id, type, amount, description, note, date, receipt_url } = req.body;

    if (category_id) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      if (!cat) return next(new AppError('Category not found', 404, 'NotFound'));
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id:     req.user.id,
        category_id: category_id || null,
        type,
        amount,
        description,
        note:        note || null,
        date:        date || new Date().toISOString().split('T')[0],
        receipt_url: receipt_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data, message: 'Transaction created' });
  } catch (err) {
    next(err);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_id, type, amount, description, note, date, receipt_url } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) return next(new AppError('Transaction not found', 404, 'NotFound'));

    const updates = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (type        !== undefined) updates.type        = type;
    if (amount      !== undefined) updates.amount      = amount;
    if (description !== undefined) updates.description = description;
    if (note        !== undefined) updates.note        = note;
    if (date        !== undefined) updates.date        = date;
    if (receipt_url !== undefined) updates.receipt_url = receipt_url;

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data, message: 'Transaction updated' });
  } catch (err) {
    next(err);
  }
};

export const deleteTransaction = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return next(new AppError('Transaction not found', 404, 'NotFound'));
    return res.json({ message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
};

export const scanReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No receipt image uploaded', 400, 'ValidationError'));
    }

    const receiptUrl = await uploadToCatbox(req.file.buffer, req.file.originalname);
    const extracted = await extractReceiptData(req.file.buffer);

    res.json({
      message: 'Receipt scanned successfully',
      data: {
        url: receiptUrl,
        extracted_text: extracted.rawText,
        suggested_total: extracted.suggestedTotal,
        suggested_date: extracted.suggestedDate
      }
    });
  } catch (error) {
    next(error);
  }
};
