import { supabaseAnon as supabase } from '../config/supabase.js';

export const getRecurring = async (req, res) => {
  try {
    const { profile_id } = req.query;
    if (!profile_id) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id required' });
    }
    const { data: recurring, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('profile_id', profile_id)
      .order('next_date', { ascending: true });
    if (error) throw error;
    return res.status(200).json({ data: recurring || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createRecurring = async (req, res) => {
  try {
    const { profile_id } = req.query;
    const { category_id, type, amount, description, frequency, next_date } = req.body;
    const user_id = req.user.id;
    if (!profile_id) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id required' });
    }
    const { data: rt, error } = await supabase
      .from('recurring_transactions')
      .insert({ profile_id, user_id, category_id, type, amount, description, frequency, next_date, status: 'active' })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data: rt, message: 'Recurring transaction created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateRecurring = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, frequency, next_date, status } = req.body;
    const { data: rt, error } = await supabase
      .from('recurring_transactions')
      .update({ amount, description, frequency, next_date, status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data: rt, message: 'Recurring transaction updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteRecurring = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Recurring transaction deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
