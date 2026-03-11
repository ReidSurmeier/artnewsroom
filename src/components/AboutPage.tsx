'use client';

export default function AboutPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="about-page">
      <button className="about-back" onClick={onBack}>← Back</button>
      <div className="about-content" id="about-content">
        {/* Content will be written by the user */}
        <p className="about-placeholder">About page — content coming soon.</p>
      </div>
    </div>
  );
}
