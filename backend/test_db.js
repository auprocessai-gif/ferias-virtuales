require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check messages table
  const { data, error } = await supabase.from('messages').select('*').limit(1);
  console.log('Messages table check:', error ? error.message : 'Exists. Data: ' + JSON.stringify(data));

  // Check buckets
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  console.log('Buckets:', bucketError ? bucketError : buckets.map(b => b.name));

  if (!buckets?.find(b => b.name === 'auditorium')) {
     console.log('Creating auditorium bucket...');
     const res = await supabase.storage.createBucket('auditorium', { public: true });
     console.log('Create Bucket result:', res);
  }
}

check();
