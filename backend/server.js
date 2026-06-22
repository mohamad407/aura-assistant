const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const OpenAI = require('openai'); // We use the OpenAI SDK because Groq uses the same format
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve frontend files
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

// Initialize Groq (gives access to multiple open-source models for FREE)
const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// 1. Define 5 different AI Models (Hosted on Groq for free)
const aiModels = [
    { name: "Llama-3.3-70B", model: "llama-3.3-70b-versatile" },
    { name: "Llama-3.1-8B", model: "llama-3.1-8b-instant" },
    { name: "Mixtral-8x7B", model: "mixtral-8x7b-32768" },
    { name: "Gemma-2-9B", model: "gemma2-9b-it" },
    { name: "Llama-3.1-70B", model: "llama-3.1-70b-versatile" }
];

// 2. Query all 5 AIs in parallel and synthesize with a Judge AI
async function getConsensusAnswer(prompt) {
    try {
        console.log(`🧠 Consulting ${aiModels.length} AI models in parallel...`);
        
        // Query all models at the exact same time
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
        
        // 3. Pass all responses to the Judge AI to synthesize the best one
        console.log("⚖️ Judge AI is synthesizing the ultimate answer...");
              const judgeCompletion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information.
                
                CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. If the user asks in French, reply entirely in French. If they ask to describe something in Hindi, reply entirely in Hindi. Output ONLY the final perfect response.`
            }],
        });

        return judgeCompletion.choices[0].message.content;
        
    } catch (error) {
        console.error("Consensus Engine Error:", error);
        return "I encountered an error while consulting my AI network.";
    }
}

// ==========================================
// 🛣️ API ENDPOINTS
// ==========================================

/**
 * GET /history/:userId
 * Fetches all chat messages for a specific user, sorted by oldest to newest.
 */
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

/**
 * POST /chat
 * Receives user text, saves it to MongoDB, triggers Multi-AI Engine, saves AI response, returns it.
 */
app.post('/chat', async (req, res) => {
  const { text, userId } = req.body;

  if (!text || !userId) {
    return res.status(400).json({ error: "Missing text or userId" });
  }

  try {
    // 1. Save user message to MongoDB
    await Chat.create({ userId, role: 'user', text });

    // 2. Get the ultimate answer from the 5 AI Consensus Engine
    const aiResponse = await getConsensusAnswer(text);

    // 3. Save the final synthesized AI response to MongoDB
    await Chat.create({ userId, role: 'assistant', text: aiResponse });

    // 4. Send response back to frontend
    res.json({ reply: aiResponse });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🚀 AURA Multi-AI Backend running on port ${PORT}`);
});
