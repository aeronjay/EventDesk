import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function check() {
  const { data, error } = await supabase.from('solicitations').select('status')
  if (error) {
    console.error(error)
    return
  }
  
  const statuses = data.map(d => d.status)
  const uniqueStatuses = [...new Set(statuses)]
  console.log('Unique Statuses:')
  uniqueStatuses.forEach(s => {
    console.log(`"${s}"`)
  })
}

check()
