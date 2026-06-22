const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
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

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

// --- Groq Multi-AI Engine ---
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
        const promises = aiModels.map(async (ai) => {
            try {
                const completion = await openai.chat.completions.create({
                    model: ai.model,
                    messages: [{ role: "user", content: prompt }],
                });
                return { name: ai.name, text: completion.choices[0].message.content };
            } catch (err) {
                return { name: ai.name, text: "Error generating response." };
            }
        });

        const allResponses = await Promise.all(promises);
        const judgeCompletion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. Never say you cannot speak a language. Output ONLY the final perfect response.`
            }],
        });
        return judgeCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Consensus Engine Error:", error);
        return "I encountered an error while consulting my AI network.";
    }
}

// ==========================================
// 🎙️ CLOUD TEXT-TO-SPEECH ENGINE (Like ChatGPT)
// ==========================================

// Map detected language to high-quality Microsoft Azure Neural Voices
function getEdgeVoice(langPrefix) {
    const voices = {
        'ta': 'ta-IN-ValluvarNeural', // Tamil
        'hi': 'hi-IN-MadhurNeural',   // Hindi
        'bn': 'bn-IN-BashkarNeural',  // Bengali
        'ml': 'ml-IN-MidhunNeural',   // Malayalam
        'te': 'te-IN-MohanNeural',    // Telugu
        'ar': 'ar-SA-HamedNeural',    // Arabic
        'zh': 'zh-CN-YunxiNeural',    // Chinese
        'ja': 'ja-JP-KeitaNeural',    // Japanese
        'ko': 'ko-KR-InJoonNeural',   // Korean
        'ru': 'ru-RU-DmitryNeural',   // Russian
        'fr': 'fr-FR-HenriNeural',    // French
        'es': 'es-ES-AlvaroNeural',   // Spanish
        'de': 'de-DE-ConradNeural',   // German
        'it': 'it-IT-DiegoNeural',    // Italian
        'pt': 'pt-PT-DuarteNeural'    // Portuguese
    };
    return voices[langPrefix] || 'en-US-GuyNeural'; // Default to high-quality English
}

app.post('/tts', async (req, res) => {
    const { text, lang } = req.body;
    try {
        const voice = getEdgeVoice(lang);
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        
        const audioBuffers = [];
        const stream = tts.toStream(text);
        
        for await (const chunk of stream) {
            audioBuffers.push(chunk);
        }
        
        const finalBuffer = Buffer.concat(audioBuffers);
        res.set('Content-Type', 'audio/mpeg');
        res.send(finalBuffer);
    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).send("TTS Error");
    }
});

// --- API ENDPOINTS ---
app.get('/history/:userId', async (req, res) => {
  try {
    const history = await Chat.find({ userId }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
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
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AURA Multi-AI Backend running on port ${PORT}`);
});
