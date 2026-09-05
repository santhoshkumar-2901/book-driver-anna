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
    text: `Welcome to Book Driver Anna Support Desk.\n\nHow can we help you today?\n\n• **In-City Hourly Drivers** (Starts @ ₹199 / 2 hrs)\n• **Night Party Drivers** (24/7 safe drive home @ ₹399)\n• **Outstation Drivers** (Coorg, Mysuru, Ooty & more)\n• **Vehicle Rentals** (Sedans, SUVs & Tempo Travellers)\n• **Driving Classes** (Doorstep 1-on-1 certified training)\n\nAsk any question about our services, hourly rates, or coverage areas!`,
    timestamp: 'Just now',
    actions: [
      { label: 'Driving Classes', query: 'Tell me about driving classes and fees' },
      { label: 'Hourly Driver Rates', query: 'What are hourly driver rates?' },
      { label: 'Night Drivers', query: 'Tell me about night party driver service' },
      { label: 'Outstation Trips', query: 'Outstation trips to Coorg and Mysore' },
      { label: 'Vehicle Rentals', query: 'What rental cars and vehicles do you have?' }
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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans">
      
      {/* 1. FLOATING CHAT TRIGGER BUTTON */}
      {!isOpen && (
        <div className="relative group">
          {/* Welcome Tooltip Callout */}
          {notificationBubble && (
            <div className="absolute bottom-16 right-0 mb-2 w-60 sm:w-64 max-w-[calc(100vw-2.5rem)] p-3 bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl text-xs text-slate-200 backdrop-blur-md animate-bounce">
              <div className="flex items-start gap-2">
                <span className="text-lg">🚗</span>
                <div>
                  <p className="font-bold text-amber-400">Ask Anna AI!</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Need driver fares, airport drops, or outstation packages? Click to chat!</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setNotificationBubble(false); }}
                  className="text-slate-400 hover:text-white ml-auto"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Trigger Button */}
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Anna AI Customer Support"
            className="relative flex items-center gap-2.5 sm:gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-bold shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-amber-200/40"
          >
            {/* Animated online pulse indicator */}
            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
            </span>

            <div className="flex items-center gap-2">
              <SteeringWheel className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 animate-spin-slow" />
              <span className="text-xs sm:text-sm font-extrabold tracking-tight">Ask Anna AI</span>
            </div>

            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-900 fill-amber-900" />
          </button>
        </div>
      )}

      {/* 2. CHATBOT WINDOW */}
      {isOpen && (
        <div className="w-[calc(100vw-2rem)] sm:w-[410px] h-[580px] max-h-[82dvh] sm:max-h-[85vh] bg-slate-950/95 backdrop-blur-2xl border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/20 flex flex-col overflow-hidden animate-fade-in transition-all">
          
          {/* A. HEADER */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/40 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
                  <SteeringWheel className="w-6 h-6" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
              </div>
              
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm text-white font-['Outfit']">Anna AI Assistant</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-500/30">
                    Anna AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  Book Driver Anna • 24x7 Active
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Reset Chat */}
              <button
                onClick={handleClearChat}
                title="Reset Chat"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Minimize/Close */}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
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
                        className={`p-3 rounded-lg leading-relaxed text-xs ${
                          isAnna
                            ? 'bg-slate-900 border border-slate-800 text-slate-200'
                            : 'bg-amber-500 text-slate-950 font-semibold'
                        }`}
                      >
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Interactive Action Buttons / Direct Booking Trigger */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.actions.map((act, actIdx) => (
                            <button
                              key={actIdx}
                              onClick={() => handleActionClick(act)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors flex items-center gap-1.5 ${
                                act.type
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-slate-950'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
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
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-500">
                  <SteeringWheel className="w-3.5 h-3.5 animate-spin-slow" />
                </div>
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[10px] text-slate-400 ml-1 font-medium">Assistant typing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* D. QUICK TOPICS BAR */}
          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendMessage('What are your hourly driver packages and rates?')}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium whitespace-nowrap transition-colors border border-slate-800"
            >
              Hourly Rates
            </button>
            <button
              onClick={() => handleSendMessage('Tell me about night party drivers in Koramangala')}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium whitespace-nowrap transition-colors border border-slate-800"
            >
              Night Drivers
            </button>
            <button
              onClick={() => handleSendMessage('Can I book an outstation driver for Coorg?')}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium whitespace-nowrap transition-colors border border-slate-800"
            >
              Outstation
            </button>
            <button
              onClick={() => handleSendMessage('How much does it cost to rent an Innova SUV?')}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium whitespace-nowrap transition-colors border border-slate-800"
            >
              SUV Rental
            </button>
          </div>

          {/* E. CHAT INPUT FOOTER */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about fares, outstation routes, fleet..."
              className="flex-grow px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors shadow-sm shrink-0"
              aria-label="Send query"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
