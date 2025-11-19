import { ReactNode } from 'react'
import LogoutButton from './LogoutButton'

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1">
      {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm text-gray-600">
          <div>Developed by LIKEPASS Inc.</div>
          <LogoutButton />
        </div>
      </footer>
    </div>
  )
}

