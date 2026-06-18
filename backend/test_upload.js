require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testUpload() {
  try {
    const fs = require('fs');
    fs.writeFileSync('test.pdf', 'dummy content');
    const file = fs.readFileSync('test.pdf');
    const { data, error } = await supabase.storage.from('auditorium').upload('presentations/test.pdf', file, { contentType: 'application/pdf', upsert: true });
    console.log('Upload Result:', error ? error.message : data);
  } catch(e) {
    console.log('Exception:', e.message);
  }
}
testUpload();
