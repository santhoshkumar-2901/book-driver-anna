import React, { useState } from 'react';
import { 
  Phone, Mail, MapPin, Clock, Send, CheckCircle2, 
  HelpCircle, ChevronDown, ChevronUp, Building2 
} from 'lucide-react';
import { BANGALORE_AREAS } from '../data/mockData';

export default function ContactPage({ openBookingModal }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    area: 'Indiranagar',
    subject: 'General Inquiry',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', phone: '', email: '', area: 'Indiranagar', subject: 'General Inquiry', message: '' });
    }, 4000);
  };

  const hubs = [
    { name: "Indiranagar Flagship HQ", address: "#42, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038", phone: "+91 98860 12345" },
    { name: "Koramangala Hub", address: "#18, 80 Feet Road, 4th Block, Koramangala, Bengaluru 560034", phone: "+91 98860 54321" },
    { name: "Whitefield Hub", address: "Ground Floor, ITPL Main Road, Whitefield, Bengaluru 560066", phone: "+91 98860 67890" },
    { name: "Electronic City Kiosk", address: "Phase 1 Gate 2, Hosur Road, Electronic City, Bengaluru 560100", phone: "+91 98860 99887" }
  ];

  const faqs = [
    {
      q: "How fast will a driver arrive at my location in Bangalore?",
      a: "Our driver partners are distributed across 15 operational hubs across Bengaluru. Average arrival time is between 15 to 25 minutes depending on traffic conditions."
    },
    {
      q: "Can I book a driver for late-night party returns?",
      a: "Yes. Our night service operates 24/7. Drivers adhere to strict conduct rules and breathalyzer verification for late-night drives."
    },
    {
      q: "Are fuel and toll charges included in vehicle rentals?",
      a: "For vehicle rentals with drivers, fuel is included in standard daily packages. Road tolls (such as NICE Road or Airport Expressway) are paid directly based on official receipts."
    },
    {
      q: "What is the cancellation policy?",
      a: "We offer zero cancellation fees when cancelled at least 30 minutes before the scheduled pickup time."
    },
    {
      q: "Are the drivers experienced with luxury and automatic cars?",
      a: "Yes. All driver partners are evaluated on manual, automatic, AMT, and luxury vehicle transmissions."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Header */}
      <div className="space-y-3 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium">
          <Phone className="w-3.5 h-3.5 text-amber-400" /> Customer Support Desk
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white font-['Outfit']">
          Contact & Support
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Reach our Bengaluru operations desk for driver reservations, corporate contracts, or service inquiries.
        </p>
      </div>

      {/* Main Grid: Form + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Contact Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          
          <div>
            <h3 className="text-lg font-bold text-white font-['Outfit']">
              Send an Inquiry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit your message and our dispatch desk will respond promptly.
            </p>
          </div>

          {submitted ? (
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Inquiry Received</h4>
              <p className="text-xs text-slate-300">
                Thank you, {formData.name || 'valued customer'}. Our team will contact you at {formData.phone || 'your phone number'} shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-xs font-medium text-slate-300 mb-1">Phone Number *</label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9886012345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="contact-area" className="block text-xs font-medium text-slate-300 mb-1">Bengaluru Area</label>
                  <select
                    id="contact-area"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                <select
                  id="contact-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                >
                  <option value="General Inquiry">General Booking Inquiry</option>
                  <option value="Book Driver">Hourly / Outstation Driver Request</option>
                  <option value="Book Vehicle">Car Rental Inquiry</option>
                  <option value="Monthly Driver">Monthly / Corporate Contract</option>
                  <option value="Become Driver Partner">Driver Partner Application</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-medium text-slate-300 mb-1">Message or Requirements *</label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Provide trip details, date, or specific inquiries..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-400 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Inquiry</span>
              </button>
            </form>
          )}

        </div>

        {/* Contact Info Cards */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white">
              Direct Contact Lines
            </h4>

            <div className="space-y-3 text-xs text-slate-300">
              <a href="tel:+919886012345" className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="p-2 bg-amber-400/10 text-amber-400 rounded-md">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">24x7 Helpline</div>
                  <div className="text-sm font-bold text-white">+91 98860 12345</div>
                  <div className="text-[11px] text-slate-400">Direct phone & WhatsApp</div>
                </div>
              </a>

              <a href="mailto:support@bookdriveranna.com" className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="p-2 bg-amber-400/10 text-amber-400 rounded-md">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Support Email</div>
                  <div className="text-sm font-bold text-white">support@bookdriveranna.com</div>
                  <div className="text-[11px] text-slate-400">Response within 2-4 hours</div>
                </div>
              </a>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="p-2 bg-amber-400/10 text-amber-400 rounded-md">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Operating Hours</div>
                  <div className="text-sm font-bold text-white">24 Hours / 7 Days a Week</div>
                  <div className="text-[11px] text-slate-400">Night shift drivers active 24/7</div>
                </div>
              </div>
            </div>
          </div>

          {/* Local Hubs List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white">
              Bengaluru Dispatch Hubs
            </h4>
            <div className="space-y-2">
              {hubs.map((hub, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" /> {hub.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{hub.address}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* FAQS SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit']">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Key details regarding booking, safety standards, and pricing
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-3.5 text-left font-semibold text-xs sm:text-sm text-white flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-300 border-t border-slate-800/60 pt-2.5 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
