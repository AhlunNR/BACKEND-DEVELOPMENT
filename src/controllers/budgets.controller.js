import { supabaseAdmin as supabase } from '../config/supabase.js';

export const getBudgets = async (req, res) => {
  try {
    const profile_id = req.profile.id;
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'BadRequest', message: 'month, and year are required' });
    }
    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*, categories(name, icon, color)')
      .eq('profile_id', profile_id)
      .eq('month', month)
      .eq('year', year);
    if (error) throw error;
    return res.status(200).json({ data: budgets || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createBudget = async (req, res) => {
  try {
    const profile_id = req.profile.id;
    const { category_id, amount, month, year } = req.body;
    const user_id = req.user.id;
    const { data: budget, error } = await supabase
      .from('budgets')
      .insert({ profile_id, user_id, category_id, amount, month, year })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data: budget, message: 'Budget created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const { data: budget, error } = await supabase
      .from('budgets')
      .update({ amount })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data: budget, message: 'Budget updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Budget deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
