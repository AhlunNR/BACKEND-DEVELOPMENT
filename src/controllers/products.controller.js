import { supabaseAdmin } from '../config/supabase.js';

export const getProducts = async (req, res) => {
  try {
    const profileId = req.profile.id;
    const { is_active, low_stock } = req.query;

    let query = supabaseAdmin
      .from('products')
      .select('*, categories(name, icon, color)')
      .eq('profile_id', profileId)
      .order('name', { ascending: true });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    if (low_stock === 'true') {
      query = query.filter('stock', 'lte', 'low_stock_threshold');
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, categories(name, icon, color)')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const profileId = req.profile.id;
    const userId = req.user.id;
    const { name, description, price, cost_price, stock, low_stock_threshold, unit, category_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({ profile_id: profileId, user_id: userId, name, description, price, cost_price, stock, low_stock_threshold, unit, category_id })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data, message: 'Product created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;
    const { name, description, price, cost_price, stock, low_stock_threshold, unit, category_id, is_active } = req.body;

    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ name, description, price, cost_price, stock, low_stock_threshold, unit, category_id, is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ data, message: 'Product updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const profileId = req.profile.id;

    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }

    const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Product deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment } = req.body;
    const profileId = req.profile.id;

    const { data: product, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('stock')
      .eq('id', id)
      .eq('profile_id', profileId)
      .single();

    if (fetchErr || !product) {
      return res.status(404).json({ error: 'NotFound', message: 'Product not found' });
    }

    const newStock = Math.max(0, Number(product.stock) + Number(adjustment));

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ data, message: 'Stock adjusted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
