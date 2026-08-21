/**
 * No navbar, no footer — the auth screen owns the full viewport so the split
 * photo panel reads edge-to-edge (§4).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
