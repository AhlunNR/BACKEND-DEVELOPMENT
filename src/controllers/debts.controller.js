import { supabaseAdmin as supabase } from '../config/supabase.js';

export const getDebts = async (req, res) => {
  try {
    const profile_id = req.profile.id;
    const { data: debts, error } = await supabase
      .from('debts')
      .select('*')
      .eq('profile_id', profile_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data: debts || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createDebt = async (req, res) => {
  try {
    const profile_id = req.profile.id;
    const { name, type, amount, due_date } = req.body;
    const user_id = req.user.id;
    const { data: debt, error } = await supabase
      .from('debts')
      .insert({ profile_id, user_id, name, type, amount, remaining_amount: amount, due_date, status: 'unpaid' })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data: debt, message: 'Debt created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, due_date } = req.body;
    const { data: debt, error } = await supabase
      .from('debts')
      .update({ name, due_date })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ data: debt, message: 'Debt updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const payDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    const { data: currentDebt, error: getErr } = await supabase
      .from('debts')
      .select('remaining_amount, amount')
      .eq('id', id)
      .single();
      
    if (getErr || !currentDebt) {
      return res.status(404).json({ error: 'NotFound', message: 'Debt not found' });
    }
    
    let newRemaining = Number(currentDebt.remaining_amount) - Number(amount);
    if (newRemaining < 0) newRemaining = 0;
    
    let newStatus = 'partial';
    if (newRemaining === 0) newStatus = 'paid';
    if (newRemaining === Number(currentDebt.amount)) newStatus = 'unpaid';

    const { data: debt, error } = await supabase
      .from('debts')
      .update({ remaining_amount: newRemaining, status: newStatus })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return res.status(200).json({ data: debt, message: 'Debt payment recorded' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Debt deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
