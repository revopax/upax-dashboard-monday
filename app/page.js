// Disable SSR entirely — dashboard is behind Basic Auth (no SEO needed).
// Module-level new Date() in constants.js produces different values on
// server (UTC) vs client (CDMX), causing React hydration errors
// #425/#418/#423 that cannot be fixed without moving all date logic
// to useEffect across 15+ files. ssr:false is the correct solution.
import dynamic from 'next/dynamic'

const App = dynamic(() => import('./Dashboard'), { ssr: false })
export default function Page() { return <App /> }
