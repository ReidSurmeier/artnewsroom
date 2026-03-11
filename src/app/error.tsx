'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'AUTHENTICSans-Condensed-90, sans-serif',
        gap: '12px',
      }}
    >
      <h1 style={{ fontSize: '1.1rem', fontWeight: 'normal' }}>
        Something went wrong
      </h1>
      <button
        onClick={reset}
        style={{
          fontFamily: 'AUTHENTICSans-Condensed-90, sans-serif',
          fontSize: '0.8rem',
          border: '1px solid #222',
          background: 'none',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
