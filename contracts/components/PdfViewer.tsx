"use client";

interface Props {
  url: string | null;
  title?: string;
}

export function PdfViewer({ url, title = "PDF Preview" }: Props) {
  if (!url) {
    return <p className="muted">PDF not available.</p>;
  }

  return (
    <div className="pdf-viewer">
      <iframe src={url} title={title} />
    </div>
  );
}
