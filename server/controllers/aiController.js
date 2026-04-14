import { GoogleGenAI } from '@google/genai';

let ai = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.log('Gemini AI Initialization skipped:', e.message);
}

export const generateSmartReplies = async (req, res) => {
  try {
    const { messageText } = req.body;
    if (!messageText) return res.status(400).json({ message: "Message text is required" });

    if (!ai) {
      // Mock replies if key not set
      return res.json({ replies: ['Got it!', 'Awesome', 'Give me a sec'] });
    }

    const prompt = `Based on the following chat message, generate 3 short, context-aware, distinct quick replies (1-4 words max per reply). Just return the replies as a generic json array of strings, nothing else. Message: "${messageText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let text = response.text;
    
    // Extract array from markdown payload if present
    if (text.includes('[')) {
      text = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
    }
    
    const replies = JSON.parse(text);
    res.json({ replies });
  } catch (error) {
    console.error('Smart replies error:', error);
    res.status(500).json({ message: 'Failed to generate replies' });
  }
};

export const generateChatSummary = async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Valid messages array is required" });
    }

    if (!ai) {
      return res.json({ summary: "No API Key configured.\nSummary unavailable." });
    }

    const conversationContext = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');
    const prompt = `Summarize the following chat conversation into a concise bulleted list of the main points. Keep it professional but brief. Do not use markdown backticks, just output the bullets directly:\n\n${conversationContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: 'Failed to generate summary' });
  }
};
