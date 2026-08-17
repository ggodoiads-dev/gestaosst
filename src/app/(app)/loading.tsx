export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 p-6">
      <span className="size-8 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
      <p className="text-sm text-foreground-subtle">Carregando...</p>
    </div>
  );
}
