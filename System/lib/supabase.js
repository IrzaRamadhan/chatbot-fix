const { createClient } = require('@supabase/supabase-js');

// Hardcoded for now based on web-admin/.env
const SUPABASE_URL = 'https://tfkikjuhalkxqvxsrcxl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRma2lranVoYWxreHF2eHNyY3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MjIwMzgsImV4cCI6MjA4NjA5ODAzOH0._ulu7qbp3iGUBofdvwqUblvaR4islvuH47q9NLPDuG8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
