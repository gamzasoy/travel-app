export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
      <div className="h-24 rounded-2xl bg-muted" />
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
    </div>
  );
}
