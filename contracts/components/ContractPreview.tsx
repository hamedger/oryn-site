"use client";

interface Props {
  html: string;
  onClose?: () => void;
}

export function ContractPreview({ html, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal contract-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Contract Preview</h2>
          {onClose && (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div
          className="contract-preview-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
