export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'AUTHENTICSans-Condensed-90, sans-serif',
        gap: '8px',
      }}
    >
      <h1 style={{ fontSize: '1.3rem', fontWeight: 'normal' }}>404</h1>
      <p style={{ fontSize: '0.85rem', opacity: 0.4 }}>Page not found.</p>
    </div>
  );
}
