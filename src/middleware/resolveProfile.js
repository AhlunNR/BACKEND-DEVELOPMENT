import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const resolveProfile = async (req, _res, next) => {
  try {
    const profileId = req.query.profile_id || req.body?.profile_id;

    let query = supabaseAdmin
      .from('financial_profiles')
      .select('*')
      .eq('user_id', req.user.id);

    if (profileId) {
      query = query.eq('id', profileId);
    } else {
      query = query.eq('is_default', true);
    }

    const { data: profile, error } = await query.maybeSingle();

    if (error) return next(error);
    if (!profile) {
      return next(new AppError(
        profileId
          ? 'Profile not found or does not belong to this user'
          : 'No default profile found. Please create a profile first.',
        404,
        'NotFound'
      ));
    }

    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
};

export default resolveProfile;
