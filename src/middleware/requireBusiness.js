import { supabaseAdmin } from '../config/supabase.js';

const requireBusinessProfile = async (req, res, next) => {
  try {
    const profileId = req.query.profile_id || req.body?.profile_id;

    if (!profileId) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'profile_id is required for this endpoint',
      });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('financial_profiles')
      .select('id, user_id, type')
      .eq('id', profileId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'NotFound', message: 'Profile not found' });
    }

    if (profile.type !== 'business') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This endpoint is only available for business profiles',
      });
    }

    const isOwner = profile.user_id === req.user.id;

    if (!isOwner) {
      const { data: membership } = await supabaseAdmin
        .from('profile_members')
        .select('role, status')
        .eq('profile_id', profileId)
        .eq('user_id', req.user.id)
        .eq('status', 'accepted')
        .single();

      if (!membership) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this business profile',
        });
      }

      req.memberRole = membership.role;
    } else {
      req.memberRole = 'owner';
    }

    req.profile = profile;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'InternalServerError', message: err.message });
  }
};

export const requireEditor = (req, res, next) => {
  if (req.memberRole === 'viewer') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Viewer role cannot perform write operations',
    });
  }
  next();
};

export default requireBusinessProfile;
