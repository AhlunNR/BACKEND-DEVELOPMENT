import { supabaseAnon as supabase } from '../config/supabase.js';

export const getGoals = async (req, res) => {
  try {
    const { profile_id } = req.query;
    if (!profile_id) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id required' });
    }
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .eq('profile_id', profile_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data: goals || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createGoal = async (req, res) => {
  try {
    const { profile_id } = req.query;
    const { name, target_amount, current_amount = 0, deadline } = req.body;
    const user_id = req.user.id;
    if (!profile_id) {
      return res.status(400).json({ error: 'BadRequest', message: 'profile_id required' });
    }
    const { data: goal, error } = await supabase
      .from('goals')
      .insert({ profile_id, user_id, name, target_amount, current_amount, deadline })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data: goal, message: 'Goal created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, target_amount, current_amount, deadline } = req.body;
    const { data: goal, error } = await supabase
      .from('goals')
      .update({ name, target_amount, current_amount, deadline })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data: goal, message: 'Goal updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Goal deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
