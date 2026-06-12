export function generateStaticParams() {
  return [{ token: "_" }];
}

export default function SignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
