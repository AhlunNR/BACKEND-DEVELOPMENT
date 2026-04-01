import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const getProfiles = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('financial_profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const createProfile = async (req, res, next) => {
  try {
    const { name, type, icon, color } = req.body;

    const { count } = await supabaseAdmin
      .from('financial_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    const isFirst = count === 0;

    const { data, error } = await supabaseAdmin
      .from('financial_profiles')
      .insert({
        user_id:    req.user.id,
        name,
        type,
        icon:       icon  || (type === 'business' ? '🏢' : '👤'),
        color:      color || '#6366f1',
        is_default: isFirst,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data, message: 'Profile created' });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('financial_profiles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) return next(new AppError('Profile not found', 404, 'NotFound'));

    const updates = {};
    if (name  !== undefined) updates.name  = name;
    if (icon  !== undefined) updates.icon  = icon;
    if (color !== undefined) updates.color = color;

    const { data, error } = await supabaseAdmin
      .from('financial_profiles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

export const deleteProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('financial_profiles')
      .select('id, is_default')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!existing) return next(new AppError('Profile not found', 404, 'NotFound'));
    if (existing.is_default) {
      return next(new AppError('Cannot delete the default profile. Set another profile as default first.', 400, 'BadRequest'));
    }

    const { count } = await supabaseAdmin
      .from('financial_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (count <= 1) {
      return next(new AppError('Cannot delete the only profile', 400, 'BadRequest'));
    }

    const { error } = await supabaseAdmin
      .from('financial_profiles')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    return res.json({ message: 'Profile deleted' });
  } catch (err) {
    next(err);
  }
};

export const setDefaultProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: target } = await supabaseAdmin
      .from('financial_profiles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!target) return next(new AppError('Profile not found', 404, 'NotFound'));

    await supabaseAdmin
      .from('financial_profiles')
      .update({ is_default: false })
      .eq('user_id', req.user.id);

    const { data, error } = await supabaseAdmin
      .from('financial_profiles')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data, message: 'Default profile updated' });
  } catch (err) {
    next(err);
  }
};
