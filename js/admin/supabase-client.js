// Supabase Client Initialization
// Importante: No ambiente real de produção, essas chaves devem vir de variáveis de ambiente.
// Para este projeto (Vanilla JS estático), usamos chaves públicas anon.

const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Inicializa o cliente do Supabase
// Requer o script CDN do Supabase previamente carregado no HTML.
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabase;
