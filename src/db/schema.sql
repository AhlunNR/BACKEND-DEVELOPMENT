CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY,
  email       TEXT        UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('personal', 'business')),
  icon        TEXT        DEFAULT '👤',
  color       TEXT        DEFAULT '#6366f1',
  is_default  BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'viewer',
  status      TEXT        NOT NULL CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
  notes            TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, email)
);

CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  UUID        REFERENCES financial_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  icon        TEXT        DEFAULT '💰',
  color       TEXT        DEFAULT '#6366f1',
  is_default  BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id    UUID          REFERENCES financial_profiles(id) ON DELETE CASCADE,
  category_id   UUID          REFERENCES categories(id) ON DELETE SET NULL,
  type          TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
  amount        NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description   TEXT          NOT NULL,
  note          TEXT,
  date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  receipt_url   TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  category_id UUID          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  month       INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER       NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (profile_id, category_id, month, year)
);

CREATE TABLE IF NOT EXISTS goals (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id     UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  target_amount  NUMERIC(15,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(15,2) DEFAULT 0 CHECK (current_amount >= 0),
  deadline       DATE,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debts (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id       UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  type             TEXT          NOT NULL CHECK (type IN ('payable', 'receivable')),
  amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  remaining_amount NUMERIC(15,2) NOT NULL CHECK (remaining_amount >= 0),
  due_date         DATE,
  status           TEXT          NOT NULL CHECK (status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid',
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  category_id  UUID          REFERENCES categories(id) ON DELETE SET NULL,
  type         TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description  TEXT          NOT NULL,
  frequency    TEXT          NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_date    DATE          NOT NULL,
  status       TEXT          NOT NULL CHECK (status IN ('active', 'paused')) DEFAULT 'active',
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON transactions;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_goals ON goals;
CREATE TRIGGER set_updated_at_goals
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_debts ON debts;
CREATE TRIGGER set_updated_at_debts
  BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_rt ON recurring_transactions;
CREATE TRIGGER set_updated_at_rt
  BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users: own row"         ON users;
DROP POLICY IF EXISTS "profiles: own rows"     ON financial_profiles;
DROP POLICY IF EXISTS "profile_members: own"   ON profile_members;
DROP POLICY IF EXISTS "categories: own rows"   ON categories;
DROP POLICY IF EXISTS "transactions: own rows" ON transactions;
DROP POLICY IF EXISTS "budgets: own rows"      ON budgets;
DROP POLICY IF EXISTS "goals: own rows"        ON goals;
DROP POLICY IF EXISTS "debts: own rows"        ON debts;
DROP POLICY IF EXISTS "rt: own rows"           ON recurring_transactions;

CREATE POLICY "users: own row" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "profiles: own rows" ON financial_profiles
  FOR ALL USING (
    auth.uid() = user_id
    OR id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "profile_members: own" ON profile_members
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "categories: own rows" ON categories
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "transactions: own rows" ON transactions
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "budgets: own rows" ON budgets
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "goals: own rows" ON goals
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "debts: own rows" ON debts
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "rt: own rows" ON recurring_transactions
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE INDEX IF NOT EXISTS idx_profiles_user_id        ON financial_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_members_profile_id      ON profile_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id         ON profile_members(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id      ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_profile_id   ON categories(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_profile_id ON transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_profile_id      ON budgets(profile_id);
CREATE INDEX IF NOT EXISTS idx_goals_profile_id        ON goals(profile_id);
CREATE INDEX IF NOT EXISTS idx_debts_profile_id        ON debts(profile_id);
CREATE INDEX IF NOT EXISTS idx_rt_profile_id           ON recurring_transactions(profile_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID  NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT  NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, name)
);

CREATE TABLE IF NOT EXISTS customers (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID  NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT  NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id            UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id        UUID          REFERENCES categories(id) ON DELETE SET NULL,
  name               TEXT          NOT NULL,
  description        TEXT,
  price              NUMERIC(15,2) NOT NULL CHECK (price >= 0),
  cost_price         NUMERIC(15,2) DEFAULT 0 CHECK (cost_price >= 0),
  stock              INTEGER       DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER      DEFAULT 5,
  unit               TEXT          DEFAULT 'pcs',
  is_active          BOOLEAN       DEFAULT TRUE,
  created_at         TIMESTAMPTZ   DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code            TEXT          NOT NULL,
  discount_type   TEXT          NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  NUMERIC(15,2) NOT NULL CHECK (discount_value > 0),
  min_purchase    NUMERIC(15,2) DEFAULT 0,
  max_uses        INTEGER,
  used_count      INTEGER       DEFAULT 0,
  valid_from      DATE,
  valid_until     DATE,
  is_active       BOOLEAN       DEFAULT TRUE,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (profile_id, code)
);

CREATE TABLE IF NOT EXISTS pos_orders (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID          NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id       UUID          REFERENCES customers(id) ON DELETE SET NULL,
  payment_method_id UUID          REFERENCES payment_methods(id) ON DELETE SET NULL,
  voucher_id        UUID          REFERENCES vouchers(id) ON DELETE SET NULL,
  transaction_id    UUID          REFERENCES transactions(id) ON DELETE SET NULL,
  subtotal          NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount   NUMERIC(15,2) DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL CHECK (total >= 0),
  note              TEXT,
  status            TEXT          NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_order_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID          NOT NULL REFERENCES pos_orders(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT          NOT NULL,
  price       NUMERIC(15,2) NOT NULL,
  cost_price  NUMERIC(15,2) DEFAULT 0,
  quantity    INTEGER       NOT NULL CHECK (quantity > 0),
  subtotal    NUMERIC(15,2) NOT NULL
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers: own rows"     ON customers;
DROP POLICY IF EXISTS "products: own rows"      ON products;
DROP POLICY IF EXISTS "vouchers: own rows"      ON vouchers;
DROP POLICY IF EXISTS "pos_orders: own rows"    ON pos_orders;
DROP POLICY IF EXISTS "pos_items: own rows"     ON pos_order_items;
DROP POLICY IF EXISTS "payment_methods: own"    ON payment_methods;

CREATE POLICY "customers: own rows" ON customers
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "products: own rows" ON products
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "vouchers: own rows" ON vouchers
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "pos_orders: own rows" ON pos_orders
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

CREATE POLICY "pos_items: own rows" ON pos_order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM pos_orders
      WHERE user_id = auth.uid()
      OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
      OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
    )
  );

CREATE POLICY "payment_methods: own" ON payment_methods
  FOR ALL USING (
    auth.uid() = user_id
    OR profile_id IN (SELECT id FROM financial_profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT profile_id FROM profile_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

DROP TRIGGER IF EXISTS set_updated_at_customers ON customers;
CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_products ON products;
CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pos_orders ON pos_orders;
CREATE TRIGGER set_updated_at_pos_orders
  BEFORE UPDATE ON pos_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_profile_id    ON products(profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_profile_id   ON customers(profile_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_profile_id    ON vouchers(profile_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code          ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_pos_orders_profile_id  ON pos_orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_order_id     ON pos_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_profile ON payment_methods(profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON pos_orders(status);

-- ============================================================
-- Tabel notifications (global, tidak terikat user tertentu)
-- "Sudah dibaca / belum" di-handle via localStorage di frontend
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')) DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- GAMIFIKASI
-- ============================================================

-- 1. User Gamification (level, xp, streak per user)
CREATE TABLE IF NOT EXISTS user_gamification (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  xp                  INTEGER     NOT NULL DEFAULT 0,
  level               INTEGER     NOT NULL DEFAULT 1,
  streak_days         INTEGER     NOT NULL DEFAULT 0,
  last_activity_date  DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Badge definitions
CREATE TABLE IF NOT EXISTS badges (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  type        TEXT    NOT NULL CHECK (type IN ('transaction', 'level', 'streak', 'financial_health')),
  threshold   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Badges (many-to-many: user ↔ badge)
CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    UUID        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

-- 4. Daily Mission definitions
CREATE TABLE IF NOT EXISTS daily_missions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  description TEXT,
  xp_reward   INTEGER NOT NULL DEFAULT 10,
  type        TEXT    NOT NULL DEFAULT 'daily',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Daily Missions (tracking per user per day)
CREATE TABLE IF NOT EXISTS user_daily_missions (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   UUID    NOT NULL REFERENCES daily_missions(id) ON DELETE CASCADE,
  date         DATE    NOT NULL DEFAULT CURRENT_DATE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, mission_id, date)
);

-- 6. XP History (log setiap penambahan XP)
CREATE TABLE IF NOT EXISTS xp_history (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER     NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers
DROP TRIGGER IF EXISTS set_updated_at_user_gamification ON user_gamification;
CREATE TRIGGER set_updated_at_user_gamification
  BEFORE UPDATE ON user_gamification
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE user_gamification   ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_missions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_gamification: own row"     ON user_gamification;
DROP POLICY IF EXISTS "badges: read all"               ON badges;
DROP POLICY IF EXISTS "user_badges: own rows"          ON user_badges;
DROP POLICY IF EXISTS "daily_missions: read all"       ON daily_missions;
DROP POLICY IF EXISTS "user_daily_missions: own rows"  ON user_daily_missions;
DROP POLICY IF EXISTS "xp_history: own rows"           ON xp_history;

CREATE POLICY "user_gamification: own row" ON user_gamification
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "badges: read all" ON badges
  FOR SELECT USING (true);

CREATE POLICY "user_badges: own rows" ON user_badges
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "daily_missions: read all" ON daily_missions
  FOR SELECT USING (true);

CREATE POLICY "user_daily_missions: own rows" ON user_daily_missions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "xp_history: own rows" ON xp_history
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_gamification_user_id ON user_gamification(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id       ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id      ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_missions_user   ON user_daily_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_missions_date   ON user_daily_missions(date);
CREATE INDEX IF NOT EXISTS idx_xp_history_user_id        ON xp_history(user_id);

-- ============================================================
-- SEED DATA: Badges
-- ============================================================
INSERT INTO badges (key, name, description, icon, color, type, threshold) VALUES
  -- Transaction badges
  ('tx_starter',    'Starter',       'Capai 50 transaksi',         'check-circle', '#3b82f6', 'transaction', 50),
  ('tx_active',     'Active User',   'Capai 100 transaksi',        'check-circle', '#3b82f6', 'transaction', 100),
  ('tx_loyal',      'Loyal User',    'Capai 150 transaksi',        'check-circle', '#3b82f6', 'transaction', 150),
  ('tx_super',      'Super User',    'Capai 200 transaksi',        'check-circle', '#3b82f6', 'transaction', 200),
  -- Financial health badges
  ('health_good',   'Sehat Finansial',    'Raih skor finansial 80',        'heart-pulse', '#10b981', 'financial_health', 80),
  ('health_steady', 'Konsisten Sehat',    'Pertahankan skor 80+ selama 7 hari', 'heart-pulse', '#10b981', 'financial_health', 80),
  -- Level badges
  ('level_2',       'Paham Finansial',    'Capai Level Finansial 2',  'trophy', '#f59e0b', 'level', 2),
  ('level_3',       'Bisa Finansial',     'Capai Level Finansial 3',  'trophy', '#f59e0b', 'level', 3),
  ('level_4',       'Cakap Finansial',    'Capai Level Finansial 4',  'trophy', '#f59e0b', 'level', 4),
  ('level_5',       'Ahli Finansial',     'Capai Level Finansial 5',  'trophy', '#f59e0b', 'level', 5),
  -- Streak badges
  ('streak_3',      'Konsisten 3 Hari',   'Login streak 3 hari berturut-turut', 'flame', '#f97316', 'streak', 3),
  ('streak_7',      'Konsisten 7 Hari',   'Login streak 7 hari berturut-turut', 'flame', '#f97316', 'streak', 7),
  ('streak_14',     'Konsisten 14 Hari',  'Login streak 14 hari berturut-turut', 'flame', '#f97316', 'streak', 14)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DATA: Daily Missions
-- ============================================================
INSERT INTO daily_missions (key, title, description, xp_reward, type) VALUES
  ('record_expense', 'Catat Pengeluaran',     'Catat minimal 1 pengeluaran hari ini',   20,  'daily'),
  ('record_income',  'Catat Pemasukan',        'Catat minimal 1 pemasukan hari ini',     20,  'daily'),
  ('review_budget',  'Review Anggaran',        'Buka halaman anggaran dan review',       15,  'daily')
ON CONFLICT (key) DO NOTHING;