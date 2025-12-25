export default function DataLoading() {
  return (
    <main className="min-h-screen bg-background pb-12">
      <header className="pt-14 px-6 pb-4">
        <div className="h-5 w-20 bg-muted rounded animate-pulse mb-4" />
        <div className="h-9 w-32 bg-muted rounded animate-pulse mb-2" />
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
      </header>
      <div className="px-6 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  )
}
