// Supabase Client Initialization
// Importante: No ambiente real de produção, essas chaves devem vir de variáveis de ambiente.
// Para este projeto (Vanilla JS estático), usamos chaves públicas anon.

const SUPABASE_URL = 'https://dzxtqxbiwphfyzrtkyxf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6eHRxeGJpd3BoZnl6cnRreXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MzU2NTEsImV4cCI6MjEwMDIxMTY1MX0.yq5nrz-traro_DoEWR76Ltyw3B0OBgkVqxSD3JAK0C4';

// Inicializa o cliente do Supabase
// Requer o script CDN do Supabase previamente carregado no HTML.
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabase;
