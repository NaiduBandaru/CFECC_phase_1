import { config } from '../config/index.js';
import { initDatabase, executeRawSql } from './index.js';
import { seedDatabase } from './seed.js';

async function setupSupabase() {
  console.log('====================================================');
  console.log('CFECC Stores Management System - Supabase Provisioning');
  console.log('====================================================');

  if (!config.databaseUrl || config.databaseUrl.trim() === '') {
    console.error('\n❌ ERROR: DATABASE_URL is not set in your .env file.');
    console.error('\nPlease open the `.env` file and add your Supabase connection string:');
    console.error('DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres\n');
    process.exit(1);
  }

  try {
    console.log(`[Supabase] Connecting to database...`);
    await initDatabase();

    // Verify basic query
    const res = await executeRawSql('SELECT current_database(), current_user, version()');
    console.log(`[Supabase] ✅ Successfully connected!`);
    console.log(`[Supabase] Database: ${res.rows[0]?.current_database}`);
    console.log(`[Supabase] User: ${res.rows[0]?.current_user}`);

    // Check if tables need seeding
    const userCount = await executeRawSql('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0]?.count || '0', 10) === 0) {
      console.log(`[Supabase] Seeding default CFECC enterprise data (Roles, Employees, Commodities, Vendors)...`);
      await seedDatabase();
      console.log(`[Supabase] ✅ Database seeded successfully!`);
    } else {
      console.log(`[Supabase] ✅ Tables already populated (${userCount.rows[0]?.count} users found).`);
    }

    console.log('\n====================================================');
    console.log('🎉 Supabase is fully configured and ready for CFECC Stores!');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ Connection to Supabase failed:');
    console.error(err.message || err);
    console.error('\nTip: Check that:');
    console.error('1. Your database password is correct (and special characters in the password are URL encoded).');
    console.error('2. In Supabase, IPv4 add-on is enabled or you use the connection pooler URI.');
    console.error('3. SSL is enabled.\n');
    process.exit(1);
  }
}

setupSupabase();

