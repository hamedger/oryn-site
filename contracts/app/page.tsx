import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            Oryn Contracts
          </Link>
          <Link href="/admin/login" className="btn btn-primary btn-sm">
            Admin Login
          </Link>
        </div>
      </header>
      <main className="page-center">
        <div className="card login-card" style={{ textAlign: "center" }}>
          <h1>Oryn Contracts</h1>
          <p className="muted">Secure contract generation and electronic signing.</p>
        </div>
      </main>
    </>
  );
}
