import { supabaseAdmin } from '../config/supabase.js';

export const getCustomers = async (req, res) => {
  try {
    const profileId = req.profile.id;
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('profile_id', profileId)
      .order('name', { ascending: true });
    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();
    if (error || !data) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
    }
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const profileId = req.profile.id;
    const userId = req.user.id;
    const { name, phone, email, address } = req.body;
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({ profile_id: profileId, user_id: userId, name, phone, email, address })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Customer created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;
    const { name, phone, email, address } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('customers').select('id').eq('id', id).eq('profile_id', profileId).single();

    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
    }
    const { data, error } = await supabaseAdmin
      .from('customers').update({ name, phone, email, address }).eq('id', id).select().single();
    if (error) throw error;
    return res.status(200).json({ data, message: 'Customer updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;
    const { data: existing } = await supabaseAdmin
      .from('customers').select('id').eq('id', id).eq('profile_id', profileId).single();
    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Customer not found' });
    }
    const { error } = await supabaseAdmin.from('customers').delete().eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Customer deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
