-- Migration 010: Add images gallery array to products table
-- Adds a text[] column to store multiple product photo URLs

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Backfill: if a product already has image_url, seed images[] with it
UPDATE products
SET images = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (images IS NULL OR array_length(images, 1) IS NULL);

COMMENT ON COLUMN products.images IS 'Array of public image URLs for the product gallery. First element is the primary image.';
