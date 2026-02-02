import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/env';

// Validación ya realizada en env.ts
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
