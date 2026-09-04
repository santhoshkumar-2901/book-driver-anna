import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, X, Send, Bot, Sparkles, Check, 
  RefreshCw, ChevronDown, ExternalLink, ShieldCheck, 
  MapPin, Clock, Phone, AlertCircle
} from 'lucide-react';
import { SteeringWheel } from './Icons';
import { 
  sendQueryToGemini, 
  getOfflineKnowledgeResponse, 
  getActiveApiKey 
} from '../services/geminiService';

const INITIAL_MESSAGES = [
  {
    id: 'welcome-1',
    sender: 'anna',
    text: `🙏 **Namaskara boss! Welcome to Book Driver Anna!**\n\nI am your **Anna AI Assistant**. How can I assist you today?\n\n• **In-City Hourly Drivers** (Starts @ ₹199 / 2 hrs)\n• **Night Party Drivers** (24/7 safe drive home @ ₹399)\n• **Outstation Drivers** (Coorg, Mysore, Ooty @ ₹1,199 / day)\n• **Rental Vehicles** (Sedans, SUVs & Tempo Travellers)\n• **Driving Classes** (Doorstep 1-on-1 training from ₹2,999)\n\nFeel free to ask any question about our services, pricing, or areas!`,
    timestamp: 'Just now',
    actions: [
      { label: '🎓 Driving Classes', query: 'Tell me about driving classes and fees' },
      { label: '🚗 Hourly Driver Rates', query: 'What are hourly driver rates?' },
      { label: '🌙 Night Party Driver', query: 'Tell me about night party driver service' },
      { label: '🛣️ Outstation Trips', query: 'Outstation trips to Coorg and Mysore' },
      { label: '🚙 Rental Cars & Buses', query: 'What rental cars and vehicles do you have?' }
    ]
  }
];

export default function Chatbot({ openBookingModal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [notificationBubble, setNotificationBubble] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Check if API key is present in environment or storage
  useEffect(() => {
    setHasApiKey(Boolean(getActiveApiKey()));
  }, []);

  // Auto-scroll messages to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setNotificationBubble(false);
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  const handleSendMessage = async (customQuery = null) => {
    const query = customQuery || inputText;
    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customQuery) {
      setInputText('');
    }
    setIsLoading(true);

    try {
      const activeKey = getActiveApiKey();
      
      if (activeKey) {
        // Send to live Gemini API
        const history = [...messages, userMessage];
        const geminiReply = await sendQueryToGemini(history, activeKey);

        const annaResponse = {
          id: 'anna-' + Date.now(),
          sender: 'anna',
          text: geminiReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: '🚗 Book a Driver', type: 'driver' },
            { label: '🚙 Book a Vehicle', type: 'vehicle' }
          ]
        };
        setMessages(prev => [...prev, annaResponse]);
      } else {
        // Instant smart local knowledge response
        await new Promise(r => setTimeout(r, 450)); // natural reading pause
        const offlineResult = getOfflineKnowledgeResponse(query);

        const annaResponse = {
          id: 'anna-' + Date.now(),
          sender: 'anna',
          text: offlineResult.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: offlineResult.actions || []
        };
        setMessages(prev => [...prev, annaResponse]);
      }
    } catch (err) {
      console.warn('Gemini request encountered an issue:', err);
      // Fallback seamlessly to local knowledge base
      const fallbackResult = getOfflineKnowledgeResponse(query);

      const annaResponse = {
        id: 'anna-' + Date.now(),
        sender: 'anna',
        text: fallbackResult.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: fallbackResult.actions || []
      };
      setMessages(prev => [...prev, annaResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (action.query) {
      handleSendMessage(action.query);
    } else if (action.type && openBookingModal) {
      openBookingModal(action.type, action.data || {});
    }
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  // Helper to format text with bold, bullet points, and newlines
  const renderFormattedText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bold replacement regex
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return (
        <span key={idx} className="block mb-1">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="text-amber-300 font-semibold">{part.slice(2, -2)}</strong>;
            } else if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="text-amber-200/90">{part.slice(1, -1)}</em>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      
      {/* 1. FLOATING CHAT TRIGGER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Customer Support Chat"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs shadow-md transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-slate-950" />
          <SteeringWheel className="w-4 h-4 text-slate-950" />
          <span>Support Chat</span>
        </button>
      )}

      {/* 2. CHATBOT WINDOW */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[380px] h-[520px] max-h-[82vh] bg-slate-950 border border-slate-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
          
          {/* A. HEADER */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <SteeringWheel className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-white font-['Outfit']">Customer Assistant</h3>
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  24/7 Bengaluru Helpdesk
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                title="Reset Chat"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close Chat"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* C. MESSAGES STREAM */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg) => {
              const isAnna = msg.sender === 'anna';

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isAnna ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-start gap-2 max-w-[88%]">
                    {isAnna && (
                      <div className="w-6 h-6 rounded-full bg-amber-400/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-1">
                        <SteeringWheel className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div>
                      {/* Chat Bubble */}
                      <div
                        className={`p-3 rounded-lg leading-relaxed ${
                          isAnna
                            ? 'bg-slate-900 border border-slate-800 text-slate-200'
                            : 'bg-amber-400 text-slate-950 font-medium'
                        }`}
                      >
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Interactive Action Buttons */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.actions.map((act, actIdx) => (
                            <button
                              key={actIdx}
                              onClick={() => handleActionClick(act)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                                act.type
                                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 hover:bg-amber-400 hover:text-slate-950'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              <span>{act.label}</span>
                              {act.type && <ExternalLink className="w-2.5 h-2.5" />}
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-500 mt-1 block px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bot Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-lg p-2 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-[11px]">Finding information...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* D. QUICK RECS BAR */}
          <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage('What are your hourly driver packages and rates?')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-700 cursor-pointer"
            >
              Hourly Rates
            </button>
            <button
              onClick={() => handleSendMessage('Tell me about night party drivers in Koramangala')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-700 cursor-pointer"
            >
              Night Drivers
            </button>
            <button
              onClick={() => handleSendMessage('Can I book an outstation driver for Coorg?')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-700 cursor-pointer"
            >
              Outstation
            </button>
            <button
              onClick={() => handleSendMessage('How much does it cost to rent an Innova SUV?')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-700 cursor-pointer"
            >
              Vehicle Rental
            </button>
          </div>

          {/* E. CHAT INPUT FOOTER */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about fares, outstation, cars..."
              className="flex-grow px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-amber-400 text-xs transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
