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

async function createOrLinkAdmin(email, password, name) {
  console.log(`Setting up admin: ${email}...`);
  
  let userId;
  
  // 1. Check if user already exists in auth.users by listing them
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing auth users:', listError.message);
    return;
  }
  
  const existingUser = users.find(u => u.email === email);
  
  if (existingUser) {
    console.log(`User already exists in Supabase Auth (ID: ${existingUser.id}).`);
    userId = existingUser.id;
    // Update password just in case
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      console.log('Note: Could not update password (may require email confirmation to be toggled):', updateError.message);
    } else {
      console.log('Password set successfully.');
    }
  } else {
    // 2. Create the user if they don't exist
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name }
    });
    
    if (createError) {
      console.error(`Error creating user ${email} in auth:`, createError.message);
      return;
    }
    
    userId = newUser.user.id;
    console.log(`Auth user created successfully (ID: ${userId}).`);
  }
  
  // 3. Upsert the profile record in public.profiles table with ADMIN role
  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    name: name,
    role: 'ADMIN',
    active: true
  });
  
  if (upsertError) {
    console.error('Error upserting profile:', upsertError.message);
  } else {
    console.log(`Profile for ${email} updated as ADMIN successfully.\n`);
  }
}

async function main() {
  const password = '12345678';
  const name = 'Thầy Nguyễn Lương Việt';
  
  await createOrLinkAdmin('thaynguyenluongviet@gmail.com', password, name);
  await createOrLinkAdmin('thaynguyenluongivet@gmail.com', password, name);
  
  console.log('Done!');
}

main();
