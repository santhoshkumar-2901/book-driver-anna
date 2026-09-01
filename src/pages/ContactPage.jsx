import React, { useState } from 'react';
import { 
  Phone, Mail, MapPin, Clock, Send, MessageSquare, CheckCircle2, 
  HelpCircle, ChevronDown, ChevronUp, Sparkles, Building2 
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
      q: "How fast will Driver Anna arrive at my location in Bangalore?",
      a: "Our Annas are stationed at 25+ local hubs across Bangalore (Indiranagar, Koramangala, Whitefield, HSR, Hebbal). Average dispatch time is just 15 to 20 minutes!"
    },
    {
      q: "Can I book a driver for late night party return in Indiranagar / Koramangala?",
      a: "Yes! Our Night Party Driver service operates 24x7. Our drivers undergo strict breathalyzer tests before driving your vehicle safely to your residence."
    },
    {
      q: "Are fuel and toll charges included in vehicle rentals?",
      a: "For driver-driven rental vehicles, fuel is included in per-km packages. Toll charges (such as Airport Elevated Expressway or NICE Road) are paid directly as per actual receipts."
    },
    {
      q: "What if I need to cancel my booking?",
      a: "We offer zero cancellation fee if cancelled up to 30 minutes before pickup time."
    },
    {
      q: "Are the drivers familiar with luxury automatic cars?",
      a: "Yes, our Annas are experienced with all transmission types, including manual, AMT, CVT, DSG, and luxury automatic vehicles like Mercedes, BMW, Audi & Volvo."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold border border-amber-400/20">
          <MessageSquare className="w-3.5 h-3.5" /> 24/7 Customer Support
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white font-['Outfit']">
          Get in Touch With <span className="text-amber-400">Book Driver Anna</span>
        </h1>
        <p className="text-slate-300 text-base leading-relaxed">
          Have questions about driver packages, monthly rentals, or corporate partnerships? 
          Reach out to our Indiranagar team anytime!
        </p>
      </div>

      {/* Main Grid: Form + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Contact Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative">
          
          <h3 className="text-2xl font-extrabold text-white font-['Outfit'] mb-1">
            Send Us a Message
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Fill in your details below and our Bangalore desk will respond within 15 minutes.
          </p>

          {submitted ? (
            <div className="p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3 animate-in zoom-in-95">
              <div className="w-12 h-12 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center mx-auto font-bold">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-white font-['Outfit']">Message Received!</h4>
              <p className="text-xs text-slate-300">
                Thank you {formData.name || 'valued customer'}. Our team will call or WhatsApp you at {formData.phone || 'your phone'} shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9886012345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
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
                    placeholder="e.g. name@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bangalore Pickup Area</label>
                  <select
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {BANGALORE_AREAS.map((a, i) => (
                      <option key={i} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="General Inquiry">General Booking Inquiry</option>
                  <option value="Book Driver">Hourly / Outstation Driver Request</option>
                  <option value="Book Vehicle">Car Rental Inquiry</option>
                  <option value="Monthly Driver">Monthly / Corporate Contract</option>
                  <option value="Become Driver Partner">Become a Driver Anna (Join Us)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Message or Requirements</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us your travel details, vehicle model, or date..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Inquiry to Anna Team</span>
              </button>
            </form>
          )}

        </div>

        {/* Contact Info Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h4 className="text-lg font-bold text-white font-['Outfit'] border-l-2 border-amber-400 pl-2.5">
              Direct Contact Hotlines
            </h4>

            <div className="space-y-4 text-xs text-slate-300">
              <a href="tel:+919886012345" className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-400 transition-colors">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">24x7 Booking Helpline</div>
                  <div className="text-sm font-extrabold text-white">+91 98860 12345</div>
                  <div className="text-[10px] text-emerald-400">Instant Phone & WhatsApp</div>
                </div>
              </a>

              <a href="mailto:support@bookdriveranna.com" className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:border-amber-400 transition-colors">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Official Support Email</div>
                  <div className="text-sm font-extrabold text-white">support@bookdriveranna.com</div>
                  <div className="text-[10px] text-slate-400">Fast response within 1 hour</div>
                </div>
              </a>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Operating Hours</div>
                  <div className="text-sm font-extrabold text-white">24 Hours / 7 Days a Week</div>
                  <div className="text-[10px] text-slate-400">Night drivers active till 4 AM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Local Hubs List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
            <h4 className="text-lg font-bold text-white font-['Outfit'] border-l-2 border-amber-400 pl-2.5">
              Bengaluru Offices & Hubs
            </h4>
            <div className="space-y-2.5">
              {hubs.map((hub, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {hub.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{hub.address}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* FAQS SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 inline mr-1" /> Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-white font-['Outfit']">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm text-white flex items-center justify-between gap-4"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-amber-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-300 border-t border-slate-800/60 pt-3 leading-relaxed">
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
