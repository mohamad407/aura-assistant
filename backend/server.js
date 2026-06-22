const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MongoDB Atlas Connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🟢 MongoDB Atlas Connected to 'aura' database"))
  .catch(err => console.error("🔴 MongoDB connection error:", err));

// --- Mongoose Schema ---
const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

// ==========================================
// 🌐 LIVE WEB SEARCH ENGINE (DuckDuckGo)
// ==========================================

async function searchWeb(query) {
    try {
        // Add "2026" to the search to get the most current results
        const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + " 2026")}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = response.data;
        
        // Parse the search results from the HTML
        const snippets = [];
        const regex = /<td class="result-snippet">(.*?)<\/td>/gs;
        let match;
        while ((match = regex.exec(html)) !== null && snippets.length < 3) {
            let text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
            snippets.push(text);
        }
        return snippets.join('\n');
    } catch (e) {
        console.error("Web Search Error:", e.message);
        return "";
    }
}

// ==========================================
// 🧠 MULTI-AI CONSENSUS ENGINE (With Internet)
// ==========================================

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// Reduced to 3 models to avoid Groq free tier rate limits
const aiModels = [
    { name: "Llama-3.3-70B", model: "llama-3.3-70b-versatile" },
    { name: "Llama-3.1-8B", model: "llama-3.1-8b-instant" },
    { name: "Gemma-2-9B", model: "gemma2-9b-it" }
];

async function getConsensusAnswer(prompt) {
    try {
        // 1. Check if the user is asking about current events
        const currentEventKeywords = ['current', 'today', 'latest', '2024', '2025', '2026', '2027', 'who is', 'news', 'prime minister', 'president', 'cm', 'ceo'];
        let needsSearch = currentEventKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
        
        let webContext = "";
        if (needsSearch) {
            console.log("🌐 Searching the web for real-time info...");
            webContext = await searchWeb(prompt);
            if (webContext) {
                console.log("✅ Web context found!");
            }
        }

        console.log(`🧠 Consulting ${aiModels.length} AI models in parallel...`);
        
        const promises = aiModels.map(async (ai) => {
            try {
                let messages = [{ role: "user", content: prompt }];
                
                // 2. If we have web context, give it to the AIs so they know the 2026 facts
                if (webContext) {
                    messages = [{
                        role: "system",
                        content: `You have access to real-time web search results. Here is the latest data from the internet:\n${webContext}\n\nUse this data to answer the user's question accurately.`
                    }, { role: "user", content: prompt }];
                }

                const completion = await openai.chat.completions.create({
                    model: ai.model,
                    messages: messages,
                });
                
                let text = completion.choices[0].message.content;
                if (text.length > 1500) {
                    text = text.substring(0, 1500) + "\n\n... (code truncated for processing)";
                }
                return { name: ai.name, text: text };
            } catch (err) {
                console.error(`Error with ${ai.name}:`, err.message);
                return null;
            }
        });

        const results = await Promise.all(promises);
        const allResponses = results.filter(r => r !== null);
        
        if (allResponses.length === 0) throw new Error("All AI models were rate-limited.");

        console.log("⚖️ Judge AI is synthesizing the ultimate answer...");
        
        let judgeSystemPrompt = `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. Never say you cannot speak a language. Output ONLY the final perfect response.
                
        SYSTEM ACTIONS RULE: 
        If the user asks to open an app or website (like YouTube, Google, WhatsApp, Instagram), output EXACTLY: ACTION: URL: https://...
        If the user asks to call a specific number, output EXACTLY: ACTION: URL: tel:+1234567890
        If the user asks to call a contact (like 'call mom'), tell them you cannot access their phone contacts from a web app, but ask them to provide the number so you can dial it.
        If the user asks to send an SMS, output EXACTLY: ACTION: URL: sms:+1234567890`;
        
        // Give the Judge AI the web context too
        if (webContext) {
            judgeSystemPrompt += `\n\nIMPORTANT REAL-TIME DATA: Use this web search data to ensure your answer is up to date for 2026:\n${webContext}`;
        }

        const judgeCompletion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: judgeSystemPrompt
            }],
        });

        return judgeCompletion.choices[0].message.content;
        
    } catch (error) {
        console.error("Consensus Engine Error. Activating Single-AI Fallback...", error.message);
        
        // FALLBACK: If Multi-AI fails, just ask one fast AI directly
        try {
            const fallbackCompletion = await openai.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
            });
            return fallbackCompletion.choices[0].message.content;
        } catch (fallbackErr) {
            console.error("Fallback AI also failed:", fallbackErr.message);
            return "I'm having trouble connecting to my AI network right now due to high traffic. Please try again in a moment.";
        }
    }
}

// ==========================================
// 🎙️ CLOUD TEXT-TO-SPEECH ENGINE (Google TTS)
// ==========================================

function splitTextIntoChunks(text, maxLength = 150) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = "";

    for (const word of words) {
        if ((currentChunk + " " + word).length > maxLength) {
            chunks.push(currentChunk.trim());
            currentChunk = word;
        } else {
            currentChunk += " " + word;
        }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
}

app.post('/tts', async (req, res) => {
    const { text, lang } = req.body;
    try {
        const chunks = splitTextIntoChunks(text);
        const audioBuffers = [];

        for (const chunk of chunks) {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            audioBuffers.push(Buffer.from(response.data));
        }

        const finalBuffer = Buffer.concat(audioBuffers);
        res.set('Content-Type', 'audio/mpeg');
        res.send(finalBuffer);
    } catch (error) {
        console.error("TTS Axios Error:", error.message);
        res.status(204).send();
    }
});

// ==========================================
// 🛣️ API ENDPOINTS
// ==========================================

app.get('/history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const history = await Chat.find({ userId }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.post('/chat', async (req, res) => {
  const { text, userId } = req.body;
  if (!text || !userId) return res.status(400).json({ error: "Missing text or userId" });

  try {
    await Chat.create({ userId, role: 'user', text });
    const aiResponse = await getConsensusAnswer(text);
    await Chat.create({ userId, role: 'assistant', text: aiResponse });
    res.json({ reply: aiResponse });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

app.listen(PORT, () => console.log(`🚀 AURA Multi-AI Backend running on port ${PORT}`));
