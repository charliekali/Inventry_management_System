import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast.success('Your message has been sent successfully!');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setSending(false);
    }, 1000);
  };

  return (
    <div className="ecom-container" style={{ padding: '0 16px' }}>
      {/* Hero Section */}
      <div className="about-hero">
        <span className="about-badge">Get In Touch</span>
        <h1 className="about-title">Contact Us</h1>
        <p className="about-subtitle">
          Have any questions regarding our wholesale catalogs, custom packaging requirements, or batch logs? Send us a message.
        </p>
      </div>

      <div className="contact-grid">
        {/* Contact Information Cards */}
        <div className="contact-info-list">
          <div className="contact-info-card">
            <div className="contact-info-icon-wrapper">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="contact-info-title">Corporate Office</h3>
              <p className="contact-info-text">
                123 Spice Market Compound,<br />
                Bangalore, Karnataka - 560001
              </p>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon-wrapper">
              <Phone size={24} />
            </div>
            <div>
              <h3 className="contact-info-title">Phone Support</h3>
              <p className="contact-info-text">
                Wholesale Inquiry: +91 98765 43210<br />
                Customer Care: +91 80 1234 5678
              </p>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon-wrapper">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="contact-info-title">Email Address</h3>
              <p className="contact-info-text">
                sales@ttrims.com<br />
                support@ttrims.com
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form Card */}
        <div className="contact-form-card">
          <h2 className="contact-form-title">Send Message</h2>
          <form onSubmit={handleSubmit} className="contact-form">
            <div className="contact-form-group">
              <label className="contact-form-label">Full Name</label>
              <input 
                type="text" 
                required 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="contact-form-control"
              />
            </div>
            <div className="contact-form-group">
              <label className="contact-form-label">Email Address</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="contact-form-control"
              />
            </div>
            <div className="contact-form-group">
              <label className="contact-form-label">Subject</label>
              <input 
                type="text" 
                required 
                value={subject} 
                onChange={e => setSubject(e.target.value)}
                className="contact-form-control"
              />
            </div>
            <div className="contact-form-group">
              <label className="contact-form-label">Message</label>
              <textarea 
                rows="4" 
                required 
                value={message} 
                onChange={e => setMessage(e.target.value)}
                className="contact-form-control"
                style={{ resize: 'vertical' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={sending} 
              className="contact-submit-btn"
            >
              {sending ? 'Sending...' : 'Send Message'} <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
