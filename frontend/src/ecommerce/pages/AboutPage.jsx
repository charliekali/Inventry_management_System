import React from 'react';
import { Leaf, Compass, ShieldCheck } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="ecom-container" style={{ padding: '0 16px' }}>
      {/* Hero Section */}
      <div className="about-hero">
        <span className="about-badge">Our Story</span>
        <h1 className="about-title">About TTRIMS Spices</h1>
        <p className="about-subtitle">
          Delivering premium organic spices with complete transparency, batch traceability, and direct-to-warehouse logistics.
        </p>
      </div>

      {/* Grid of Core Values */}
      <div className="about-grid">
        <div className="about-card">
          <div className="about-card-icon">
            <Leaf size={32} />
          </div>
          <h3 className="about-card-title">100% Organic Sourcing</h3>
          <p className="about-card-text">
            We work directly with certified farmers across regions renowned for their spice quality. No synthetic pesticides, additives, or hidden chemicals.
          </p>
        </div>

        <div className="about-card">
          <div className="about-card-icon">
            <Compass size={32} />
          </div>
          <h3 className="about-card-title">Trace-to-Origin Logs</h3>
          <p className="about-card-text">
            Every package contains trace identifiers linking to our processing batch details, logistics timestamps, and chemical testing reports.
          </p>
        </div>

        <div className="about-card">
          <div className="about-card-icon">
            <ShieldCheck size={32} />
          </div>
          <h3 className="about-card-title">Quality Standards</h3>
          <p className="about-card-text">
            Our processing plants operate under stringent safety protocols. We test for essential oil contents, micro-count levels, and physical parameters.
          </p>
        </div>
      </div>

      {/* Corporate Mission / Banner */}
      <div className="about-banner">
        <div className="about-banner-content">
          <h2 className="about-banner-title">Empowering Farmers, Enabling Quality</h2>
          <p className="about-banner-text">
            TTRIMS was founded with the mission to bridge the gap between farmers and end consumers. By implementing our customized inventory tracking system (IMS), we eliminate intermediaries, guarantee fair pricing to producers, and ensure consistent quality to our retail and wholesale partners.
          </p>
        </div>
        <div className="about-stats">
          <div className="about-stat-item">
            <div className="about-stat-number">50+</div>
            <div className="about-stat-label">Partner Farms</div>
          </div>
          <div className="about-stat-item">
            <div className="about-stat-number">100%</div>
            <div className="about-stat-label">Traceability</div>
          </div>
        </div>
      </div>
    </div>
  );
}
