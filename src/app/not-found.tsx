import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center font-mono">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 p-8 text-center space-y-6">
        <h2 className="text-4xl text-red-500 font-bold">404</h2>
        <div className="h-px w-full bg-zinc-800"></div>
        <p className="text-zinc-400">The requested endpoint could not be found.</p>
        <Link href="/" className="inline-block px-6 py-2 bg-blue-950 border border-blue-900 text-blue-400 hover:bg-blue-900 hover:text-white transition-colors">
          RETURN TO DASHBOARD
        </Link>
      </div>
    </div>
  )
}
