import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const keepEmails = ['thaynguyenluongviet@gmail.com', 'thaynguyenluongivet@gmail.com'];

async function clearTable(tableName) {
  console.log(`Clearing table ${tableName}...`);
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    if (error) {
      // Table might not exist, that's okay
      console.log(`Note: Table ${tableName} could not be cleared (may not exist or empty): ${error.message}`);
    } else {
      console.log(`Successfully cleared ${tableName}.`);
    }
  } catch (e) {
    console.log(`Error clearing ${tableName}:`, e.message);
  }
}

async function main() {
  // 1. Clear child and parent tables in correct order to prevent foreign key errors
  const tables = [
    'attendance',
    'payments',
    'enrollments',
    'teacher_classes',
    'email_logs',
    'tuition_notifications',
    'submissions',
    'rooms',
    'exams',
    'lessons',
    'chapters',
    'courses',
    'classes',
    'students'
  ];

  for (const table of tables) {
    await clearTable(table);
  }

  // 2. Clean up Auth users and Profiles
  console.log('\nCleaning up auth users and profiles...');
  try {
    // List all auth users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      perPage: 1000
    });

    if (listError) {
      throw listError;
    }

    console.log(`Found ${users.length} total auth users.`);

    for (const user of users) {
      if (keepEmails.includes(user.email)) {
        console.log(`Keeping admin user: ${user.email}`);
        continue;
      }

      console.log(`Deleting auth user: ${user.email} (ID: ${user.id})...`);
      
      // Delete profile first to prevent constraint violations
      await supabase.from('profiles').delete().eq('id', user.id);
      
      // Delete auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete auth user ${user.email}:`, deleteError.message);
      } else {
        console.log(`Successfully deleted ${user.email}.`);
      }
    }

    // Delete any profiles that might not have auth users
    const { error: profileCleanError } = await supabase
      .from('profiles')
      .delete()
      .not('email', 'in', `(${keepEmails.map(e => `"${e}"`).join(',')})`);
      
    if (profileCleanError) {
      console.log('Error cleaning remaining profiles:', profileCleanError.message);
    }

  } catch (e) {
    console.error('Error during user cleanup:', e.message);
  }

  console.log('\nDatabase cleanup complete!');
}

main();
