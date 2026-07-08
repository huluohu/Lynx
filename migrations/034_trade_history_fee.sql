-- Track transaction fees in trade history so asset cost basis can include buy-side fees.
ALTER TABLE trade_history ADD COLUMN fee REAL DEFAULT 0;

