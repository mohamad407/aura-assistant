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
// 🧠 MULTI-AI CONSENSUS ENGINE (GROQ - FREE)
// ==========================================

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const aiModels = [
    { name: "Llama-3.3-70B", model: "llama-3.3-70b-versatile" },
    { name: "Llama-3.1-8B", model: "llama-3.1-8b-instant" },
    { name: "Mixtral-8x7B", model: "mixtral-8x7b-32768" },
    { name: "Gemma-2-9B", model: "gemma2-9b-it" },
    { name: "Llama-3.1-70B", model: "llama-3.1-70b-versatile" }
];

async function getConsensusAnswer(prompt) {
    try {
        console.log(`🧠 Consulting ${aiModels.length} AI models in parallel...`);
        
        const promises = aiModels.map(async (ai) => {
            try {
                const completion = await openai.chat.completions.create({
                    model: ai.model,
                    messages: [{ role: "user", content: prompt }],
                });
                return { name: ai.name, text: completion.choices[0].message.content };
            } catch (err) {
                console.error(`Error with ${ai.name}:`, err.message);
                return { name: ai.name, text: "Error generating response." };
            }
        });

        const allResponses = await Promise.all(promises);
        
        console.log("⚖️ Judge AI is synthesizing the ultimate answer...");
        const judgeCompletion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. If the user asks in Tamil, or asks to describe something in Tamil, your ENTIRE final output MUST be in pure Tamil. Never say you cannot speak a language. Output ONLY the final perfect response.`
            }],
        });

        return judgeCompletion.choices[0].message.content;
        
    } catch (error) {
        console.error("Consensus Engine Error:", error);
        return "I encountered an error while consulting my AI network.";
    }
}

// ==========================================
// 🎙️ CLOUD TEXT-TO-SPEECH ENGINE (Google TTS)
// ==========================================

app.post('/tts', async (req, res) => {
    const { text, lang } = req.body;
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.set('Content-Type', 'audio/mpeg');
        res.send(response.data);
    } catch (error) {
        console.error("TTS Axios Error:", error.message);
        res.status(204).send(); // 204 tells frontend to use fallback voice
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

app.listen(PORT, () => {
  console.log(`🚀 AURA Multi-AI Backend running on port ${PORT}`);
});
