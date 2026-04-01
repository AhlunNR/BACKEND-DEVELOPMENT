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