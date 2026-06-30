import { createClient } from '@supabase/supabase-js'

// Intentamos leer de las variables de entorno, si Vercel falla al leerlas, usamos las fijas directamente.
// NOTA: La llave anon de Supabase está diseñada para ser pública y enviarse al navegador.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pcoicxcdqmkmpezasjms.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5u-S4lh0Do7tilqq5Rz3eg_FJW5W0jT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
