"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = 'https://fvoehmsgbomajmlodmsg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2b2VobXNnYm9tYWptbG9kbXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzOTAxODMsImV4cCI6MjA2NTk2NjE4M30.DeM2pgdoG0iWH5PtQOSTnyp6WxFNbHnLXekuj9eW5UA';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
