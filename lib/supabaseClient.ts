
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zuorfwhdgylgrrlfnelt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VAVwrnaBhnShjU8-aXqepQ_c8LXdica';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
