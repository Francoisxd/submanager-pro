import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pcoicxcdqmkmpezasjms.supabase.co'
const supabaseAnonKey = 'sb_publishable_5u-S4lh0Do7tilqq5Rz3eg_FJW5W0jT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
