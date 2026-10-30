import Link from "next/link";

interface NavLinksViewProps {
  /** null while the session is still loading, so neither set of links flashes. */
  readonly signedIn: boolean | null;
}

export function NavLinksView({ signedIn }: NavLinksViewProps) {
  return (
    <span className="topnav-links">
      <Link href="/courses">Courses</Link>
      {signedIn === true ? (
        <>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/account">Account</Link>
        </>
      ) : null}
      {signedIn === false ? (
        <>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="button-link">
            Create account
          </Link>
        </>
      ) : null}
    </span>
  );
}
