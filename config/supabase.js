const { createClient } = require('@supabase/supabase-js');

// dotenv is loaded in server.js before any require() calls run.
// Using a getter pattern so we read env vars lazily (after dotenv is loaded).
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.\n' +
    '   Copy backend/.env.example → backend/.env and fill in your Supabase credentials.'
  );
}


const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

module.exports = supabase;
