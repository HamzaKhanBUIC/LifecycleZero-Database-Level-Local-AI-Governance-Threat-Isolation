'use client' // Error boundaries must be Client Components
 
import { useEffect } from 'react'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center justify-center font-mono">
      <div className="max-w-md w-full bg-red-950/20 border border-red-900 p-8 text-center space-y-6">
        <h2 className="text-2xl text-red-500 font-bold">System Failure</h2>
        <div className="h-px w-full bg-red-900/50"></div>
        <p className="text-red-400 text-sm">An unexpected error occurred processing your request.</p>
        <p className="text-zinc-500 text-xs break-all bg-black p-2 border border-zinc-900">{error.message}</p>
        <button
          onClick={() => reset()}
          className="inline-block px-6 py-2 bg-red-950 border border-red-900 text-red-400 hover:bg-red-900 hover:text-white transition-colors w-full"
        >
          RETRY OPERATION
        </button>
      </div>
    </div>
  )
}
