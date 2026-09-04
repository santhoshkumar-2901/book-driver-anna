import { ENV } from '../config/env.js';

const SYSTEM_PROMPT = `
You are "Anna AI", the official friendly, polite customer support assistant for "Book Driver Anna" in Bengaluru.
Provide prompt, warm, accurate information about:
- In-City Hourly Driver (starts @ ₹199 for 2 hours)
- Night Party Driver (starts @ ₹399)
- Outstation Highway Driver (starts @ ₹1,199 / 12 hours)
- Vehicle Rental Fleet (Sedan ₹1,999/day, SUV ₹3,499/day, 12-Seater Tempo ₹5,499/day)
- Doorstep Driving Classes (Beginner ₹5,999, Refresher ₹3,499, Own Car ₹2,999)
Keep answers concise, polite, and helpful!
`;

export async function queryGeminiAI(userPrompt, conversationHistory = []) {
  if (!ENV.GEMINI_API_KEY) {
    return getOfflineChatbotResponse(userPrompt);
  }

  try {
    const contents = conversationHistory.map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${ENV.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: replyText || getOfflineChatbotResponse(userPrompt).text };
  } catch (err) {
    console.error('[GEMINI PROXY ERROR] Falling back to offline engine:', err.message);
    return getOfflineChatbotResponse(userPrompt);
  }
}

function getOfflineChatbotResponse(query) {
  const q = (query || '').toLowerCase();
  if (q.includes('driver') || q.includes('rate') || q.includes('price')) {
    return {
      text: `🙏 **Namaskara boss!** Here are our official Bangalore driver rates:\n\n• **In-City Hourly Driver**: Starts @ ₹199 for 2 hrs (+₹80/extra hr)\n• **Airport Drop**: ₹249 flat for your car\n• **Night Party Driver**: Starts @ ₹399\n• **Outstation Trip**: Starts @ ₹1,199 / 12 hrs\n\nAll Annas are police-verified and background-checked!`
    };
  }
  if (q.includes('class') || q.includes('learn') || q.includes('school')) {
    return {
      text: `🎓 **Driving Classes with Driver Anna**:\n\n• **Beginner Course (15 Days)**: ₹5,999 all-inclusive\n• **City Confidence (7 Days)**: ₹3,499\n• **Learn in Your Own Car (7 Days)**: ₹2,999\n\nPatient, zero-shouting coaching right at your doorstep!`
    };
  }
  return {
    text: `🙏 **Namaskara! Welcome to Book Driver Anna!**\n\nWe provide verified professional drivers for your own car, rental vehicles (Sedans, SUVs, Tempos), and doorstep driving lessons in Bengaluru.\n\nNeed to book a driver or check fares? I'm here to help!`
  };
}
