import { supabaseAdmin } from '../config/supabase.js';

export const getGlobalNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data: notifications, error, count } = await supabaseAdmin
      .from('notifications')
      .select('id, title, message, type, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error && error.code === '42P01') {
      return res.status(200).json({
        warning: 'Table notifications is missing in Supabase.',
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      });
    }

    if (error) throw error;

    return res.json({
      data: notifications || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};
