export function generateStaticParams() {
  return [{ contractId: "_" }];
}

export default function ContractLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
