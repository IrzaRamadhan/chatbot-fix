# Bot Management Admin Panel 🤖

Website React.js untuk manajemen konfigurasi bot WhatsApp dan produk dengan autentikasi Supabase.

## 📋 Fitur

- ✅ **Login dengan Supabase Auth** - Sistem autentikasi aman
- ✅ **Dashboard** - Overview status bot dan akses cepat
- ✅ **Manajemen Config** - Edit konfigurasi bot dan pairing
- ✅ **Manajemen Produk** - CRUD produk dengan tabel interaktif
- ✅ **Protected Routes** - Keamanan dengan route guards
- ✅ **Modern UI** - Design premium dengan glassmorphism dan animasi

## 🚀 Setup

### 1. Install Dependencies

```bash
cd web-admin
npm install
```

### 2. Setup Supabase

Buka file `.env` dan tambahkan Supabase Anon Key Anda:

```env
VITE_SUPABASE_URL=https://tfkikjuhalkxqvxsrcxl.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

**Cara mendapatkan Anon Key:**

1. Buka [Supabase Dashboard](https://app.supabase.com/)
2. Pilih project Anda
3. Klik **Settings** → **API**
4. Copy **anon/public** key
5. Paste ke `.env` file

### 3. Setup Database Supabase

Buat tabel `products` di Supabase dengan struktur:

```sql
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to do everything
CREATE POLICY "Allow authenticated users" ON products
  FOR ALL
  USING (auth.role() = 'authenticated');
```

### 4. Setup User Authentication

Buat user di Supabase:

1. Buka **Authentication** → **Users**
2. Klik **Add User**
3. Masukkan email dan password
4. Gunakan credentials ini untuk login

### 5. Run Development Server

```bash
npm run dev
```

Website akan berjalan di `http://localhost:5173`

## 📁 Struktur Project

```
web-admin/
├── src/
│   ├── components/
│   │   └── ProtectedRoute.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── ConfigManagement.jsx
│   │   └── ProductManagement.jsx
│   ├── styles/
│   │   ├── Login.css
│   │   ├── Dashboard.css
│   │   ├── ConfigManagement.css
│   │   └── ProductManagement.css
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env
├── package.json
└── vite.config.js
```

## 🔐 Login

Default login menggunakan email/password yang Anda buat di Supabase Authentication.

Setelah login, Anda akan diarahkan ke Dashboard.

## 📦 Manajemen Produk

Di halaman **Manajemen Produk**, Anda bisa:

- ✅ Melihat semua produk dalam tabel
- ✅ Mencari produk
- ✅ Tambah produk baru
- ✅ Edit produk
- ✅ Hapus produk

## ⚙️ Manajemen Config

Di halaman **Manajemen Config**, Anda bisa:

- ✅ Melihat status bot
- ✅ Request pairing code untuk WhatsApp
- ✅ Edit konfigurasi bot (owner, bot number, dll)
- ✅ Reset session bot

## 🎨 Tech Stack

- **React 18** - UI Library
- **Vite** - Build Tool
- **React Router** - Routing
- **Supabase** - Backend & Auth
- **CSS3** - Styling dengan animations

## 📝 Notes

- Pastikan bot sedang berjalan di `http://localhost:3000` untuk fitur pairing
- Supabase anon key bersifat public, gunakan Row Level Security untuk keamanan
- Password database yang Anda berikan: `Irza520408301`

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📞 Support

Jika ada pertanyaan atau masalah, check console browser untuk error messages.
