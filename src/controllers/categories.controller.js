import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    let queryBuilder = supabaseAdmin
      .from('categories')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (type && ['income', 'expense'].includes(type)) {
      queryBuilder = queryBuilder.eq('type', type);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;
    return res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, type, icon = 'tag', color = '#6366f1' } = req.body;
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({ user_id: req.user.id, name, type, icon, color })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return next(new AppError('Category already exists', 409, 'ConflictError'));
      throw error;
    }
    return res.status(201).json({ data, message: 'Category created' });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) return next(new AppError('Category not found', 404, 'NotFound'));

    const updates = {};
    if (name  !== undefined) updates.name  = name;
    if (icon  !== undefined) updates.icon  = icon;
    if (color !== undefined) updates.color = color;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data, message: 'Category updated' });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('id, is_default')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) return next(new AppError('Category not found', 404, 'NotFound'));
    if (existing.is_default) return next(new AppError('Cannot delete a default category', 400, 'BadRequest'));

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
