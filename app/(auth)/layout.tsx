/**
 * The signed-out surfaces. They render outside the dashboard shell on purpose:
 * a rail of links you cannot follow yet is not a frame for a sign-in form, and
 * a topbar that names an account nobody has authenticated as is worse.
 *
 * This layout owns only the viewport and the canvas — the same sky the signed-in
 * shell sits under, so signing in and arriving at the dashboard read as one
 * continuous surface rather than two products. Each page inside it lays itself
 * out, because a sign-in split and a password-reset note want very different
 * shapes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="canvas min-h-screen">{children}</div>;
}
