// components/JS/config.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://plojfgqvvojpushcatsn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb2pmZ3F2dm9qcHVzaGNhdHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTUxNTUsImV4cCI6MjA4OTYzMTE1NX0.glp0fLFz6-EJgFrEB1TjnIB_ym9L8Wj9KklYGnfbYss";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);