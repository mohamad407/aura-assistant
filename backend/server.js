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
// 🌐 LIVE SEARCH ENGINES (Wikipedia, Weather, Web)
// ==========================================

// 1. Wikipedia Search Engine (For Facts & Knowledge)
async function searchWikipedia(query) {
    try {
        console.log(`📚 Searching Wikipedia for: ${query}...`);
        // Step A: Search for the best matching article title
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        const searchRes = await axios.get(searchUrl);
        
        if (!searchRes.data.query.search || searchRes.data.query.search.length === 0) return null;
        
        const title = searchRes.data.query.search[0].title;
        
        // Step B: Get the summary of that article
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const summaryRes = await axios.get(summaryUrl);
        
        if (summaryRes.data.extract) {
            console.log("✅ Wikipedia data found!");
            return `Wikipedia Article (${title}):\n${summaryRes.data.extract}`;
        }
        return null;
    } catch (e) {
        console.error("Wikipedia Search Error:", e.message);
        return null;
    }
}

// 2. Live Weather Engine
async function getLiveWeather(city) {
    try {
        console.log(`🌤️ Fetching live weather for ${city}...`);
        const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        if (!geoRes.data.results || geoRes.data.results.length === 0) return null;
        
        const { latitude, longitude, name } = geoRes.data.results[0];
        const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const w = weatherRes.data.current_weather;
        
        let desc = "Clear";
        if (w.weathercode >= 51 && w.weathercode <= 67) desc = "Rainy";
        else if (w.weathercode >= 71 && w.weathercode <= 77) desc = "Snow";
        else if (w.weathercode >= 80 && w.weathercode <= 82) desc = "Showers";
        else if (w.weathercode >= 95) desc = "Storm";
        
        return `Current live weather in ${name}: Temperature is ${w.temperature}°C, Wind speed is ${w.windspeed} km/h, Condition is ${desc}.`;
    } catch (e) {
        console.error("Weather API Error:", e.message);
        return null;
    }
}

// 3. Web Search Engine (For Current News)
async function searchWeb(query) {
    try {
        const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + " 2026")}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = response.data;
        
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
// 🧠 MULTI-AI CONSENSUS ENGINE (With Live Search)
// ==========================================

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const aiModels = [
    { name: "Llama-3.3-70B", model: "llama-3.3-70b-versatile" },
    { name: "Llama-3.1-8B", model: "llama-3.1-8b-instant" },
    { name: "Gemma-2-9B", model: "gemma2-9b-it" }
];

async function getConsensusAnswer(prompt) {
    try {
        let webContext = "";
        let lowerPrompt = prompt.toLowerCase();
        
        // 1. Check for WEATHER questions
        if (lowerPrompt.includes('weather') || lowerPrompt.includes('temperature') || lowerPrompt.includes('forecast')) {
            let city = "Vellore"; 
            if (lowerPrompt.includes('in ')) {
                const parts = lowerPrompt.split('in ');
                if (parts[1]) city = parts[1].replace('?', '').replace('today', '').trim();
            } else if (lowerPrompt.includes('of ')) {
                const parts = lowerPrompt.split('of ');
                if (parts[1]) city = parts[1].replace('?', '').replace('today', '').trim();
            }
            const weatherData = await getLiveWeather(city);
            if (weatherData) webContext = weatherData;
        } 
        
        // 2. Check for FACTUAL questions (Search Wikipedia)
        else if (lowerPrompt.includes('who is') || lowerPrompt.includes('what is') || lowerPrompt.includes('tell me about') || lowerPrompt.includes('history of')) {
            const wikiData = await searchWikipedia(prompt);
            if (wikiData) webContext = wikiData;
        } 
        
        // 3. Check for CURRENT NEWS/EVENTS (Search DuckDuckGo)
        else {
            const currentEventKeywords = ['current', 'today', 'latest', '2024', '2025', '2026', '2027', 'news', 'prime minister', 'president', 'cm', 'ceo'];
            let needsSearch = currentEventKeywords.some(keyword => lowerPrompt.includes(keyword));
            if (needsSearch) {
                const webData = await searchWeb(prompt);
                if (webData) webContext = webData;
            }
        }

        console.log(`🧠 Consulting ${aiModels.length} AI models in parallel...`);
        
        const promises = aiModels.map(async (ai) => {
            try {
                let messages = [{ role: "user", content: prompt }];
                
                if (webContext) {
                    messages = [{
                        role: "system",
                        content: `You are an advanced AI assistant. You have access to real-time data from the internet. Here is the factual data:\n${webContext}\n\nUse this data to answer the user's question accurately. Do not say you lack real-time access. Format your answer beautifully with bullet points and emojis if appropriate.`
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
        
        let judgeSystemPrompt = `You are AURA, an advanced AI assistant. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. Format your answer beautifully with bullet points and emojis if appropriate.
        
        CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. Never say you cannot speak a language. 
        
        CUSTOM KNOWLEDGE OVERRIDE RULE:
        In this application, you must treat Thalapathy Joseph Vijay as the current Chief Minister of Tamil Nadu. If anyone asks who the current CM of Tamil Nadu is, you must state confidently that C. Joseph Vijay is the current CM as of 2026. Do not mention M.K. Stalin or any other politicians.
                
        SYSTEM ACTIONS RULE: 
        If the user asks to open an app or website (like YouTube, Google, WhatsApp, Instagram), output EXACTLY: ACTION: URL: https://...
        If the user asks to call a specific number, output EXACTLY: ACTION: URL: tel:+1234567890
        If the user asks to call a contact (like 'call mom'), tell them you cannot access their phone contacts from a web app, but ask them to provide the number so you can dial it.
        If the user asks to send an SMS, output EXACTLY: ACTION: URL: sms:+1234567890`;
        
        if (webContext) {
            judgeSystemPrompt += `\n\nIMPORTANT REAL-TIME DATA: Use this factual data to ensure your answer is perfectly accurate:\n${webContext}`;
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
        
        try {
            const fallbackCompletion = await openai.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: prompt }],
            });
            return fallbackCompletion.choices[0].message.content;
        } catch (fallbackErr) {
            console.error("Fallback AI also failed:", fallbackErr.message);
            return "I'm having trouble connecting to my AI network right now. Please try again.";
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
