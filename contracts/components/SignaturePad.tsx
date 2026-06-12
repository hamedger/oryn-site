"use client";

import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

interface Props {
  onChange?: (dataUrl: string | null) => void;
}

export function SignaturePad({ onChange }: Props) {
  const ref = useRef<SignatureCanvas>(null);

  function handleEnd() {
    if (!ref.current || ref.current.isEmpty()) {
      onChange?.(null);
      return;
    }
    onChange?.(ref.current.toDataURL("image/png"));
  }

  function clear() {
    ref.current?.clear();
    onChange?.(null);
  }

  return (
    <div className="signature-pad">
      <SignatureCanvas
        ref={ref}
        penColor="#1d3557"
        canvasProps={{
          className: "signature-canvas",
          width: 500,
          height: 160,
        }}
        onEnd={handleEnd}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
        Clear signature
      </button>
    </div>
  );
}
