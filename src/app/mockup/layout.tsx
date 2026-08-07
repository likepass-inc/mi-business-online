import './mockup.css'

export default function MockupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mockup-root min-h-screen">
      {children}
    </div>
  )
}
