const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve frontend files (so you can run frontend & backend together if needed)
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
// 🧠 MULTI-AI CONSENSUS ENGINE (OpenRouter)
// ==========================================

// Initialize OpenRouter (gives access to 100+ models with 1 API key)
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 1. Define your 15+ AI Models
const aiModels = [
    { name: "GPT-4o", model: "openai/gpt-4o" },
    { name: "Claude-3.5-Sonnet", model: "anthropic/claude-3.5-sonnet" },
    { name: "Gemini-1.5-Pro", model: "google/gemini-pro-1.5" },
    { name: "Llama-3-70B", model: "meta-llama/llama-3-70b-instruct" },
    { name: "Mistral-Large", model: "mistralai/mistral-large" },
    { name: "GPT-4-Turbo", model: "openai/gpt-4-turbo" },
    { name: "Command-R-Plus", model: "cohere/command-r-plus" },
    { name: "DeepSeek-Coder", model: "deepseek/deepseek-coder" },
    { name: "Qwen-2-72B", model: "qwen/qwen-2-72b-instruct" },
    { name: "Mythomax-L2-13B", model: "gryphe/mythomax-l2-13b" },
    { name: "Mixtral-8x7B", model: "mistralai/mixtral-8x7b-instruct" },
    { name: "Claude-3-Opus", model: "anthropic/claude-3-opus" },
    { name: "GPT-3.5-Turbo", model: "openai/gpt-3.5-turbo" },
    { name: "Llama-3-8B", model: "meta-llama/llama-3-8b-instruct" },
    { name: "Gemini-1.5-Flash", model: "google/gemini-flash-1.5" }
];

// 2. Query all AIs in parallel and synthesize with a Judge AI
async function getConsensusAnswer(prompt) {
    try {
        console.log(`🧠 Consulting ${aiModels.length} AI models in parallel...`);
        
        // Query all models at the exact same time for speed
        const promises = aiModels.map(async (ai) => {
            try {
                const completion = await openrouter.chat.completions.create({
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
        const judgeCompletion = await openrouter.chat.completions.create({
            model: "openai/gpt-4o", // Using GPT-4o as the ultimate Judge
            messages: [{
                role: "system",
                content: `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. Output ONLY the final perfect response to the user.`
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

    // 2. Get the ultimate answer from the 15+ AI Consensus Engine
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
