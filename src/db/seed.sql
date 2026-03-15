INSERT INTO categories (user_id, name, type, icon, color, is_default) VALUES
  (:userId, 'Penjualan Produk',   'income',  '🛒', '#22c55e', TRUE),
  (:userId, 'Jasa / Layanan',     'income',  '🔧', '#10b981', TRUE),
  (:userId, 'Investasi',          'income',  '📈', '#06b6d4', TRUE),
  (:userId, 'Pendapatan Lainnya', 'income',  '💵', '#84cc16', TRUE)
ON CONFLICT (user_id, name, type) DO NOTHING;

INSERT INTO categories (user_id, name, type, icon, color, is_default) VALUES
  (:userId, 'Bahan Baku',         'expense', '📦', '#ef4444', TRUE),
  (:userId, 'Gaji Karyawan',      'expense', '👥', '#f97316', TRUE),
  (:userId, 'Sewa Tempat',        'expense', '🏠', '#eab308', TRUE),
  (:userId, 'Listrik & Air',      'expense', '💡', '#f59e0b', TRUE),
  (:userId, 'Transportasi',       'expense', '🚗', '#8b5cf6', TRUE),
  (:userId, 'Marketing & Iklan',  'expense', '📣', '#ec4899', TRUE),
  (:userId, 'Pengeluaran Lainnya','expense', '💸', '#6b7280', TRUE)
ON CONFLICT (user_id, name, type) DO NOTHING;
