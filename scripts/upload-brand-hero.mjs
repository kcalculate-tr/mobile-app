import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const URL = 'https://xtjakvinklthlvsfcncu.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!KEY) { console.error('Anon key yok'); process.exit(1); }
const supabase = createClient(URL, KEY);
const SRC = '/Users/ilterozisseven/Desktop/kcal/kcalculate-app/brandlandin-banner-1.jpg';
const path = `brands/kcalculate-${Date.now()}.jpg`;
const { error } = await supabase.storage.from('images').upload(path, fs.readFileSync(SRC), { contentType: 'image/jpeg', upsert: true });
if (error) { console.error('UPLOAD ERROR', error); process.exit(1); }
console.log('PUBLIC_URL', supabase.storage.from('images').getPublicUrl(path).data.publicUrl);
