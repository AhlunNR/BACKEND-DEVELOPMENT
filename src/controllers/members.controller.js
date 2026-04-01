import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../utils/mailer.js';
import config from '../config/config.js';

export const inviteMember = async (req, res) => {
  try {
    const { profile_id } = req.query;
    const { email, role } = req.body;
    const inviter_id = req.user.id;
    if (!profile_id || !email) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id and email are required' });
    }
    const memberRole = ['owner', 'editor', 'viewer'].includes(role) ? role : 'viewer';
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('financial_profiles')
      .select('name, user_id')
      .eq('id', profile_id)
      .single();
    if (profileErr || !profile || profile.user_id !== inviter_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not authorized to invite to this profile' });
    }
    const { data: existing } = await supabaseAdmin
      .from('profile_members')
      .select('id')
      .eq('profile_id', profile_id)
      .eq('email', email)
      .single();
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'User already invited or member' });
    }
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    const insertData = {
      profile_id,
      email,
      role: memberRole,
      status: 'pending'
    };
    if (targetUser) {
      insertData.user_id = targetUser.id;
    }
    const { data: newMember, error: insertErr } = await supabaseAdmin
      .from('profile_members')
      .insert(insertData)
      .select()
      .single();
    if (insertErr) throw insertErr;
    const htmlContent = `
      <div style="font-family:sans-serif;padding:20px;">
        <h2>Undangan Kolaborasi KasFlow</h2>
        <p>Anda diundang untuk berkolaborasi pada profil keuangan <strong>${profile.name}</strong> dengan peran <strong>${memberRole}</strong>.</p>
        <p>Silakan login atau daftar di <a href="${config.app.frontendUrl}">${config.app.frontendUrl}</a> lalu terima undangan di dashboard Anda.</p>
      </div>
    `;
    await sendEmail(email, `Undangan bergabung ke profil ${profile.name}`, htmlContent);
    return res.status(201).json({ data: newMember, message: 'Invite sent successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const acceptInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const user_email = req.user.email;
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('profile_members')
      .select('*')
      .eq('id', id)
      .single();
    if (inviteErr || !invite) {
      return res.status(404).json({ error: 'NotFound', message: 'Invite not found' });
    }
    if (invite.email !== user_email) {
      return res.status(403).json({ error: 'Forbidden', message: 'This invite is not for you' });
    }
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profile_members')
      .update({ status: 'accepted', user_id })
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    return res.status(200).json({ data: updated, message: 'Invite accepted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getMembers = async (req, res) => {
  try {
    const { profile_id } = req.query;
    if (!profile_id) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id required' });
    }
    const { data: members, error } = await supabaseAdmin
      .from('profile_members')
      .select('id, email, role, status, user_id, created_at')
      .eq('profile_id', profile_id);
    if (error) throw error;
    return res.status(200).json({ data: members || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('profile_members')
      .select('profile_id')
      .eq('id', id)
      .single();
    if (memberErr || !member) {
      return res.status(404).json({ error: 'NotFound', message: 'Member not found' });
    }
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('financial_profiles')
      .select('user_id')
      .eq('id', member.profile_id)
      .single();
    if (profileErr || !profile) {
      return res.status(404).json({ error: 'NotFound', message: 'Profile not found' });
    }
    if (profile.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only profile owner can remove members' });
    }
    const { error: deleteErr } = await supabaseAdmin
      .from('profile_members')
      .delete()
      .eq('id', id);
    if (deleteErr) throw deleteErr;
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
