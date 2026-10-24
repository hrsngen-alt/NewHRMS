import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateLocation() {
  const { data, error } = await supabase
    .from('company_locations')
    .update({
      lat: 23.03922,
      lng: 72.56188,
      radius_meters: 250
    })
    .eq('name', 'Ahmedabad HQ');

  if (error) {
    console.error('Error updating location:', error);
  } else {
    console.log('Office location updated successfully for Ahmedabad HQ!');
  }
}

updateLocation();
