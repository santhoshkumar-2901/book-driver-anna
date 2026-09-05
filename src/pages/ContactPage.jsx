import React, { useState } from 'react';
import { 
  Phone, Mail, MapPin, Clock, Send, MessageSquare, CheckCircle2, 
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
    { name: "Whitefield IT Hub", address: "Ground Floor, ITPL Main Road, Whitefield, Bengaluru 560066", phone: "+91 98860 67890" },
    { name: "Electronic City Kiosk", address: "Phase 1 Gate 2, Hosur Road, Electronic City, Bengaluru 560100", phone: "+91 98860 99887" }
  ];

  const faqs = [
    {
      q: "How fast can Driver Anna arrive at my location in Bengaluru?",
      a: "Our drivers are stationed across 25+ local hubs (Indiranagar, Koramangala, Whitefield, HSR, Hebbal). Typical dispatch time is between 15 to 20 minutes from booking confirmation."
    },
    {
      q: "Can I book a driver for late-night party returns in Indiranagar / Koramangala?",
      a: "Yes. Our Night Party Driver service operates 24x7. Drivers undergo breathalyzer verification before taking the wheel of your vehicle."
    },
    {
      q: "Are fuel and toll charges included in vehicle rentals?",
      a: "For fleet rental vehicles with driver, standard fuel is covered in per-km packages. Toll charges (such as Airport Elevated Expressway or NICE Road) are paid as per actual receipts."
    },
    {
      q: "What is your cancellation policy?",
      a: "We offer ₹0 cancellation fee if cancelled anytime prior to driver arrival at your pickup address."
    },
    {
      q: "Are drivers experienced with luxury automatic cars?",
      a: "Yes. Our drivers are evaluated on all transmission types, including manual, AMT, CVT, dual-clutch (DSG), and luxury automatic sedans and SUVs."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Header Banner */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
          <span>Customer Desk & Hub Network</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white font-['Outfit']">
          Contact & Dispatch Hubs
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mx-auto">
          Need assistance with ongoing bookings, corporate contracts, or driver allocation? Reach out to our operations team.
        </p>
      </div>

      {/* Main Grid: Form + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 card-surface p-6 sm:p-7">
          
          <h3 className="text-xl font-bold text-white font-['Outfit']">
            Send an Inquiry
          </h3>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Fill in your trip details below and our operations coordinator will reach out promptly.
          </p>

          {submitted ? (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center space-y-2 animate-in zoom-in-95">
              <div className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center mx-auto font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white font-['Outfit']">Inquiry Logged</h4>
              <p className="text-xs text-slate-300">
                Thank you, {formData.name || 'valued client'}. Our dispatch team will call or WhatsApp {formData.phone || 'your phone'} shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9886012345"
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. ramesh@example.com"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bengaluru Area</label>
                  <select
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="input-base"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Inquiry Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input-base"
                >
                  <option value="General Inquiry">General Booking Inquiry</option>
                  <option value="Book Driver">Hourly / Outstation Driver Request</option>
                  <option value="Book Vehicle">Fleet Rental Inquiry</option>
                  <option value="Driving Class">Driving Academy Enrollment</option>
                  <option value="Corporate">Monthly / Corporate Contract</option>
                  <option value="Join Driver">Become a Driver Partner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Trip Details or Questions</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Share your pickup locality, destination, or vehicle model..."
                  className="input-base"
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3"
              >
                <Send className="w-4 h-4" />
                <span>Submit Inquiry</span>
              </button>
            </form>
          )}

        </div>

        {/* Contact Info Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="card-surface p-5 space-y-4">
            <h4 className="text-base font-bold text-white font-['Outfit'] border-l-2 border-amber-500 pl-2.5">
              Support Channels
            </h4>

            <div className="space-y-3 text-xs text-slate-300">
              <a href="tel:+919886012345" className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="p-2 bg-slate-900 text-amber-500 rounded-md border border-slate-800">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">24/7 Helpline</div>
                  <div className="text-sm font-bold text-white">+91 98860 12345</div>
                  <div className="text-[11px] text-slate-400">Phone & WhatsApp dispatch</div>
                </div>
              </a>

              <a href="mailto:support@bookdriveranna.com" className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="p-2 bg-slate-900 text-amber-500 rounded-md border border-slate-800">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Email Desk</div>
                  <div className="text-sm font-bold text-white">support@bookdriveranna.com</div>
                  <div className="text-[11px] text-slate-400">Response within 1 business hour</div>
                </div>
              </a>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="p-2 bg-slate-900 text-amber-500 rounded-md border border-slate-800">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Hours of Operation</div>
                  <div className="text-sm font-bold text-white">24 Hours / 7 Days a Week</div>
                  <div className="text-[11px] text-slate-400">Night drivers active till 4:00 AM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Local Hubs List */}
          <div className="card-surface p-5 space-y-3">
            <h4 className="text-base font-bold text-white font-['Outfit'] border-l-2 border-amber-500 pl-2.5">
              Bengaluru Dispatch Hubs
            </h4>
            <div className="space-y-2.5">
              {hubs.map((hub, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" /> {hub.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{hub.address}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* FAQS SECTION */}
      <div className="card-surface p-6 sm:p-8 space-y-5">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Help Center
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-['Outfit'] mt-1">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="max-w-3xl space-y-2.5">
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
                  {isOpen ? <ChevronUp className="w-4 h-4 text-amber-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-400 border-t border-slate-800 pt-2.5 leading-relaxed">
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
