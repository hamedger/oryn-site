import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-center">
      <div className="card login-card" style={{ textAlign: "center" }}>
        <h1>Oryn Contracts</h1>
        <p className="muted">Secure contract generation and electronic signing.</p>
        <Link href="/admin/login" className="btn btn-primary">
          Admin Login
        </Link>
      </div>
    </main>
  );
}
