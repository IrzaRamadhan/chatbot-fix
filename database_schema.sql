-- Create Customer Table
CREATE TABLE IF NOT EXISTS customers (
    phone_number TEXT PRIMARY KEY,
    push_name TEXT,
    full_name TEXT,
    address TEXT,
    district TEXT,
    city TEXT,
    postal_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_phone TEXT REFERENCES customers(phone_number),
    product_id TEXT,
    quantity INTEGER,
    total_amount NUMERIC,
    shipping_cost NUMERIC,
    courier_company TEXT,
    courier_service TEXT,
    status TEXT DEFAULT 'draft', -- draft, pending_payment, paid, shipped, cancelled
    biteship_draft_id TEXT,
    biteship_order_id TEXT,
    biteship_waybill_id TEXT,
    proof_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
