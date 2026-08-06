export function StatusMessage({ kind, children }: { kind: "success" | "warning" | "error" | "info"; children: React.ReactNode }) {
  const icon = kind === "success" ? "✓" : kind === "error" ? "!" : kind === "warning" ? "!" : "i";
  return <div className={`status status-${kind}`} role={kind === "error" ? "alert" : "status"}><span aria-hidden="true">{icon}</span><div>{children}</div></div>;
}
