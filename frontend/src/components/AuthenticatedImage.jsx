import { useEffect, useState } from "react";
import { fetchAuthenticatedImageUrl } from "../api/resources";

// Drop-in-ish replacement for <img src="/uploads/payment-proofs/...">.
// Payment-proof files require a valid Bearer token to fetch now (see
// backend/src/app.js's paymentProofAccess) — a plain <img src> never sends
// that, so this fetches the image as an authenticated blob first and uses
// the resulting object URL as the actual src.
export default function AuthenticatedImage({ src, alt, className, onClick }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created = null;
    setFailed(false);
    setObjectUrl(null);
    fetchAuthenticatedImageUrl(src)
      .then((url) => {
        if (cancelled) return;
        created = url;
        setObjectUrl(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (created) window.URL.revokeObjectURL(created);
    };
  }, [src]);

  if (failed) {
    return <span className={`${className || ""} text-xs text-red-600`}>Failed to load</span>;
  }
  if (!objectUrl) {
    return <span className={`${className || ""} text-xs text-slate-400`}>Loading…</span>;
  }
  return <img src={objectUrl} alt={alt} className={className} onClick={onClick} />;
}
