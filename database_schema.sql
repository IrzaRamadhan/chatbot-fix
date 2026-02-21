-- Create Customer Table
CREATE TABLE IF NOT EXISTS customers (
    phone_number TEXT PRIMARY KEY,
    push_name TEXT,
    full_name TEXT,
    address TEXT,
    district TEXT,
    city TEXT,
    postal_code TEXT,
    current_session TEXT DEFAULT 'idle',
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

-- Create Follow-Up Config Table
CREATE TABLE IF NOT EXISTS followup_config (
    id SERIAL PRIMARY KEY,
    session_type TEXT NOT NULL,
    session_stage TEXT DEFAULT '',
    ai_instruction TEXT NOT NULL,
    delay_seconds INTEGER DEFAULT 300,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default follow-up configs
INSERT INTO followup_config (session_type, session_stage, ai_instruction, delay_seconds) VALUES
('idle', '', 'Tanya ke customer apakah ada yang bisa dibantu, sebutkan 1-2 produk unggulan. Ajak cek katalog.', 300),
('ongkir', 'parse_form', 'Ingatkan customer untuk mengisi form pemesanan (jumlah dan alamat lengkap).', 300),
('ongkir', 'select_courier', 'Ingatkan customer untuk memilih kurir pengiriman dari pilihan yang tersedia.', 300),
('ongkir', 'review_order', 'Ingatkan customer bahwa pesanan sudah siap diproses dan menunggu konfirmasi.', 300),
('ongkir', 'waiting_payment', 'Ingatkan customer untuk segera upload bukti pembayaran agar pesanan bisa diproses.', 300),
('ongkir', 'waiting_admin_confirm', 'Sampaikan bahwa bukti pembayaran sudah diterima dan sedang diverifikasi admin.', 600),
('cs', 'active', 'Sampaikan ke customer bahwa CS sedang memproses permintaan mereka, mohon bersabar.', 600)
ON CONFLICT DO NOTHING;
