import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../config/supabase.js';

export const getPaymentMethods = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('profile_id', req.profile.id)
      .eq('is_active', true);
    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createPaymentMethod = async (req, res) => {
  try {
    const { name } = req.body;
    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({ profile_id: req.profile.id, user_id: req.user.id, name })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Payment method created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('payment_methods').select('id').eq('id', id).eq('profile_id', req.profile.id).single();
    if (!existing) return res.status(404).json({ error: 'NotFound', message: 'Payment method not found' });
    const { error } = await supabaseAdmin.from('payment_methods').delete().eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Payment method deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getVouchers = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vouchers').select('*').eq('profile_id', req.profile.id).order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ data: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createVoucher = async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_purchase, max_uses, valid_from, valid_until } = req.body;
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .insert({ profile_id: req.profile.id, user_id: req.user.id, code: code.toUpperCase(), discount_type, discount_value, min_purchase, max_uses, valid_from, valid_until })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ data, message: 'Voucher created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('vouchers').select('id').eq('id', id).eq('profile_id', req.profile.id).single();
    if (!existing) return res.status(404).json({ error: 'NotFound', message: 'Voucher not found' });
    const { data, error } = await supabaseAdmin
      .from('vouchers').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    return res.status(200).json({ data, message: 'Voucher updated' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('vouchers').select('id').eq('id', id).eq('profile_id', req.profile.id).single();
    if (!existing) return res.status(404).json({ error: 'NotFound', message: 'Voucher not found' });
    const { error } = await supabaseAdmin.from('vouchers').delete().eq('id', id);
    if (error) throw error;
    return res.status(200).json({ message: 'Voucher deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const validateVoucher = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const { data: voucher, error } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('profile_id', req.profile.id)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !voucher) {
      return res.status(404).json({ error: 'NotFound', message: 'Voucher not found or inactive' });
    }
    if (voucher.valid_from && today < voucher.valid_from) {
      return res.status(400).json({ error: 'BadRequest', message: 'Voucher not yet valid' });
    }
    if (voucher.valid_until && today > voucher.valid_until) {
      return res.status(400).json({ error: 'BadRequest', message: 'Voucher has expired' });
    }
    if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
      return res.status(400).json({ error: 'BadRequest', message: 'Voucher usage limit reached' });
    }
    if (subtotal && Number(subtotal) < Number(voucher.min_purchase)) {
      return res.status(400).json({ error: 'BadRequest', message: `Minimum purchase is Rp ${voucher.min_purchase}` });
    }

    let discountAmount = 0;
    if (voucher.discount_type === 'percent') {
      discountAmount = (Number(subtotal) * Number(voucher.discount_value)) / 100;
    } else {
      discountAmount = Number(voucher.discount_value);
    }

    return res.status(200).json({ data: { voucher, discount_amount: discountAmount } });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const { status, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('pos_orders')
      .select('*, customers(name, phone), payment_methods(name), vouchers(code), pos_order_items(*)', { count: 'exact' })
      .eq('profile_id', req.profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('created_at', `${start_date}T00:00:00`);
    if (end_date) query = query.lte('created_at', `${end_date}T23:59:59`);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.status(200).json({
      data: data || [],
      pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) }
    });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('pos_orders')
      .select('*, customers(name, phone, email), payment_methods(name), vouchers(code, discount_type, discount_value), pos_order_items(*)')
      .eq('id', id)
      .eq('profile_id', req.profile.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'NotFound', message: 'Order not found' });
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const profileId = req.profile.id;
    const userId = req.user.id;
    const { items, customer_id, payment_method_id, voucher_code, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'items array is required' });
    }

    const productIds = items.map(i => i.product_id).filter(Boolean);
    let productsMap = {};

    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('products').select('id, name, price, cost_price, stock').in('id', productIds).eq('profile_id', profileId);
      productsMap = Object.fromEntries((products || []).map(p => [p.id, p]));
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = item.product_id ? productsMap[item.product_id] : null;
      const name = product ? product.name : (item.name || 'Item');
      const price = product ? Number(product.price) : Number(item.price || 0);
      const costPrice = product ? Number(product.cost_price) : 0;
      const quantity = Number(item.quantity || 1);
      const itemSubtotal = price * quantity;

      if (product && product.stock < quantity) {
        return res.status(400).json({ error: 'BadRequest', message: `Stok ${name} tidak mencukupi` });
      }

      orderItems.push({ product_id: item.product_id || null, name, price, cost_price: costPrice, quantity, subtotal: itemSubtotal });
      subtotal += itemSubtotal;
    }

    let discountAmount = 0;
    let voucherId = null;

    if (voucher_code) {
      const today = new Date().toISOString().split('T')[0];
      const { data: voucher } = await supabaseAdmin
        .from('vouchers').select('*').eq('profile_id', profileId).eq('code', voucher_code.toUpperCase()).eq('is_active', true).single();

      if (voucher && (!voucher.valid_until || today <= voucher.valid_until) && (!voucher.max_uses || voucher.used_count < voucher.max_uses) && subtotal >= Number(voucher.min_purchase)) {
        discountAmount = voucher.discount_type === 'percent'
          ? (subtotal * Number(voucher.discount_value)) / 100
          : Number(voucher.discount_value);
        voucherId = voucher.id;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('pos_orders')
      .insert({ profile_id: profileId, user_id: userId, customer_id: customer_id || null, payment_method_id: payment_method_id || null, voucher_id: voucherId, subtotal, discount_amount: discountAmount, total, note, status: 'paid' })
      .select().single();

    if (orderErr) throw orderErr;

    const itemsToInsert = orderItems.map(item => ({ ...item, order_id: order.id }));
    const { error: itemsErr } = await supabaseAdmin.from('pos_order_items').insert(itemsToInsert);
    if (itemsErr) throw itemsErr;

    for (const item of orderItems) {
      if (item.product_id) {
        const product = productsMap[item.product_id];
        await supabaseAdmin.from('products').update({ stock: Math.max(0, product.stock - item.quantity) }).eq('id', item.product_id);
      }
    }

    if (voucherId) {
      await supabaseAdmin.from('vouchers').update({ used_count: supabaseAdmin.rpc('increment', { x: 1 }) }).eq('id', voucherId);
    }

    const { data: saleCat } = await supabaseAdmin
      .from('categories').select('id').eq('profile_id', profileId).eq('name', 'Penjualan Produk').eq('type', 'income').maybeSingle();

    const { data: tx } = await supabaseAdmin
      .from('transactions')
      .insert({ profile_id: profileId, user_id: userId, category_id: saleCat?.id || null, type: 'income', amount: total, description: `POS Order #${order.id.slice(0, 8)}`, date: new Date().toISOString().split('T')[0] })
      .select().single();

    if (tx) {
      await supabaseAdmin.from('pos_orders').update({ transaction_id: tx.id }).eq('id', order.id);
    }

    return res.status(201).json({ data: { ...order, items: itemsToInsert }, message: 'Order created' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from('pos_orders').select('*').eq('id', id).eq('profile_id', req.profile.id).single();

    if (fetchErr || !order) return res.status(404).json({ error: 'NotFound', message: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'BadRequest', message: 'Order already cancelled' });

    const { data: items } = await supabaseAdmin.from('pos_order_items').select('*').eq('order_id', id);

    for (const item of (items || [])) {
      if (item.product_id) {
        const { data: product } = await supabaseAdmin.from('products').select('stock').eq('id', item.product_id).single();
        if (product) {
          await supabaseAdmin.from('products').update({ stock: product.stock + item.quantity }).eq('id', item.product_id);
        }
      }
    }

    if (order.transaction_id) {
      await supabaseAdmin.from('transactions').delete().eq('id', order.transaction_id);
    }

    const { data, error } = await supabaseAdmin
      .from('pos_orders').update({ status: 'cancelled', transaction_id: null }).eq('id', id).select().single();
    if (error) throw error;

    return res.status(200).json({ data, message: 'Order cancelled' });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const printReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabaseAdmin
      .from('pos_orders')
      .select('*, customers(name, phone), payment_methods(name), vouchers(code), pos_order_items(*), financial_profiles(name)')
      .eq('id', id)
      .eq('profile_id', req.profile.id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'NotFound', message: 'Order not found' });

    const doc = new PDFDocument({ size: [226, 700], margin: 10 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${id.slice(0, 8)}.pdf"`);
    doc.pipe(res);

    const storeName = order.financial_profiles?.name || 'Toko';
    const orderDate = new Date(order.created_at).toLocaleString('id-ID');
    const fmt = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

    doc.fontSize(12).font('Helvetica-Bold').text(storeName, { align: 'center' });
    doc.fontSize(8).font('Helvetica').text('Struk Pembelian', { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`Tanggal : ${orderDate}`);
    doc.text(`Order   : #${id.slice(0, 8).toUpperCase()}`);
    if (order.customers) doc.text(`Pelanggan: ${order.customers.name}`);
    if (order.payment_methods) doc.text(`Pembayaran: ${order.payment_methods.name}`);
    doc.moveDown(0.3);
    doc.text('--------------------------------');
    doc.font('Helvetica-Bold');

    for (const item of (order.pos_order_items || [])) {
      doc.fontSize(8).font('Helvetica').text(`${item.name}`);
      doc.text(`  ${item.quantity} x ${fmt(item.price)}`, { continued: true });
      doc.text(fmt(item.subtotal), { align: 'right' });
    }

    doc.text('--------------------------------');
    doc.font('Helvetica').text(`Subtotal`, { continued: true }).text(fmt(order.subtotal), { align: 'right' });

    if (Number(order.discount_amount) > 0) {
      if (order.vouchers) doc.text(`Diskon (${order.vouchers.code})`, { continued: true }).text(`-${fmt(order.discount_amount)}`, { align: 'right' });
    }

    doc.font('Helvetica-Bold').text(`TOTAL`, { continued: true }).text(fmt(order.total), { align: 'right' });
    doc.text('--------------------------------');
    doc.font('Helvetica').fontSize(8).text('Terima kasih sudah berbelanja!', { align: 'center' });

    doc.end();
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const profileId = req.profile.id;
    const startDate = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const { data: orders, error } = await supabaseAdmin
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('profile_id', profileId)
      .eq('status', 'paid')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (error) throw error;

    const totalRevenue = (orders || []).reduce((s, o) => s + Number(o.total), 0);
    const totalCost = (orders || []).reduce((s, o) => s + (o.pos_order_items || []).reduce((ss, i) => ss + (Number(i.cost_price) * i.quantity), 0), 0);
    const grossProfit = totalRevenue - totalCost;

    return res.status(200).json({
      data: orders || [],
      summary: {
        period: { start: startDate, end: endDate },
        total_orders: (orders || []).length,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        gross_profit: grossProfit,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'InternalServerError', message: error.message });
  }
};
