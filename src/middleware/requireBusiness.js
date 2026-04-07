import { supabaseAdmin } from '../config/supabase.js';

const requireBusinessProfile = async (req, res, next) => {
  try {
    const profileId = req.query.profile_id || req.body?.profile_id;
    const profileType = req.headers['x-profile-type'] || 'business';

    let profile = null;
    let memberRole = 'owner';

    // Try finding the profile based on ID or Type for the owner
    let query = supabaseAdmin
      .from('financial_profiles')
      .select('id, user_id, type')
      .eq('user_id', req.user.id)
      .eq('type', 'business');

    if (profileId) {
      query = query.eq('id', profileId);
    } else {
      query = query.order('is_default', { ascending: false }).limit(1);
    }

    const { data: profiles } = await query;
    profile = profiles?.[0];

    // If not found as owner, check if user is a member of someone else's business profile
    if (!profile && !profileId) {
      const { data: memberships } = await supabaseAdmin
        .from('profile_members')
        .select('role, status, profile_id')
        .eq('user_id', req.user.id)
        .eq('status', 'accepted')
        .limit(1);
      
      const membership = memberships?.[0];

      if (membership) {
        const { data: memberProfiles } = await supabaseAdmin
          .from('financial_profiles')
          .select('id, user_id, type')
          .eq('id', membership.profile_id)
          .eq('type', 'business')
          .single();
        
        if (memberProfiles) {
          profile = memberProfiles;
          memberRole = membership.role;
        }
      }
    } else if (!profile && profileId) {
        // If profile_id was provided, check if user is member of THAT specific profile
        const { data: membership } = await supabaseAdmin
        .from('profile_members')
        .select('role, status, profile_id')
        .eq('profile_id', profileId)
        .eq('user_id', req.user.id)
        .eq('status', 'accepted')
        .single();

        if (membership) {
          const { data: memberProfile } = await supabaseAdmin
            .from('financial_profiles')
            .select('id, user_id, type')
            .eq('id', profileId)
            .eq('type', 'business')
            .single();
          if (memberProfile) {
            profile = memberProfile;
            memberRole = membership.role;
          }
        }
    }

    if (!profile) {
      return res.status(404).json({ error: 'NotFound', message: 'Business profile not found or access denied.' });
    }

    if (profile.type !== 'business') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This endpoint is only available for business profiles',
      });
    }

    req.profile = profile;
    req.memberRole = memberRole;
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
