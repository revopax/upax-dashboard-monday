// Server Component wrapper — forces dynamic rendering so SSR
// always runs with current date, preventing hydration mismatch
// from stale static HTML (React #425/#418/#423)
export const dynamic = 'force-dynamic'

import App from './Dashboard'
export default App
