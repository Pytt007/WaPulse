-- migration 011: link deals to orders
-- Adds an optional order_id FK on deals so a "Won" deal can reference
-- the resulting order without breaking existing rows.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN deals.order_id IS
  'References the order that was created when this deal was marked as Won.';
