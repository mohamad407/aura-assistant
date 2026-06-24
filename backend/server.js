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
    { name: "Gemma-2-9B", model: "gemma2-9b-it" }
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
        const judgeCompletion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: `You are the ultimate Judge AI. The user asked: "${prompt}". Here are answers from multiple AI models: ${JSON.stringify(allResponses)}. Synthesize the absolute best, most accurate single response. Combine the best points from the different models. Ignore incorrect information. CRITICAL RULE: You MUST reply in the EXACT SAME LANGUAGE the user used or requested. Never say you cannot speak a language. Output ONLY the final perfect response.
                
                SYSTEM ACTIONS RULE: 
                If the user asks to open an app or website (like YouTube, Google, WhatsApp, Instagram), output EXACTLY: ACTION: URL: https://...
                If the user asks to call a specific number, output EXACTLY: ACTION: URL: tel:+1234567890
                If the user asks to call a contact (like 'call mom'), tell them you cannot access their phone contacts from a web app, but ask them to provide the number so you can dial it.
                If the user asks to send an SMS, output EXACTLY: ACTION: URL: sms:+1234567890`
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
// 🎵 SPOTIFY INTEGRATION (NEW)
// ==========================================
// Cache token to avoid multiple requests

let spotifyTokenCache = null;
let spotifyTokenExpireTime = 0;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Endpoint 1: Get Spotify Access Token
app.get('/api/spotify/token', async (req, res) => {
  try {
    // Check if we have a cached token that's still valid
    if (spotifyTokenCache && Date.now() < spotifyTokenExpireTime) {
      console.log('✅ Using cached Spotify token');
      return res.json({ 
        accessToken: spotifyTokenCache,
        source: 'cache',
        expiresIn: Math.floor((spotifyTokenExpireTime - Date.now()) / 1000)
      });
    }

    console.log('🔑 Requesting new Spotify access token...');

    // Request new token from Spotify
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      null,
      {
        params: {
          grant_type: 'client_credentials'
        },
        auth: {
          username: SPOTIFY_CLIENT_ID,
          password: SPOTIFY_CLIENT_SECRET
        }
      }
    );

    // Cache the token
    spotifyTokenCache = response.data.access_token;
    // Token valid for 3600 seconds, cache for 3500 to be safe
    spotifyTokenExpireTime = Date.now() + (response.data.expires_in - 100) * 1000;

    console.log('✅ New Spotify token received, expires in ' + response.data.expires_in + ' seconds');

    res.json({ 
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      source: 'fresh'
    });

  } catch (error) {
    console.error('❌ Spotify token error:', error.message);
    
    res.status(500).json({ 
      error: 'Failed to get Spotify access token',
      details: error.message,
      hint: 'Check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env'
    });
  }
});

// Endpoint 2: Search Songs on Spotify
app.get('/api/spotify/search', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Get cached or fresh token
    let token = spotifyTokenCache;
    
    if (!token || Date.now() >= spotifyTokenExpireTime) {
      console.log('🔑 Token expired, requesting new one...');
      const tokenRes = await axios.post(
        'https://accounts.spotify.com/api/token',
        null,
        {
          params: { grant_type: 'client_credentials' },
          auth: {
            username: SPOTIFY_CLIENT_ID,
            password: SPOTIFY_CLIENT_SECRET
          }
        }
      );
      token = tokenRes.data.access_token;
      spotifyTokenCache = token;
      spotifyTokenExpireTime = Date.now() + (tokenRes.data.expires_in - 100) * 1000;
    }

    // Search Spotify
    console.log(`🔍 Searching Spotify for: "${q}"`);
    const searchRes = await axios.get(
      'https://api.spotify.com/v1/search',
      {
        params: {
          q: q,
          type: 'track',
          limit: limit
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const tracks = searchRes.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      uri: track.uri,
      image: track.album.images[0]?.url,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      url: track.external_urls.spotify
    }));

    console.log(`✅ Found ${tracks.length} tracks`);
    res.json({ 
      query: q,
      results: tracks,
      total: searchRes.data.tracks.total
    });

  } catch (error) {
    console.error('❌ Spotify search error:', error.message);
    res.status(500).json({ 
      error: 'Search failed',
      details: error.message
    });
  }
});

// Endpoint 3: Health Check
app.get('/api/spotify/health', (req, res) => {
  const isConfigured = 
    SPOTIFY_CLIENT_ID && 
    SPOTIFY_CLIENT_ID !== 'YOUR_CLIENT_ID_HERE' &&
    SPOTIFY_CLIENT_SECRET && 
    SPOTIFY_CLIENT_SECRET !== 'YOUR_CLIENT_SECRET_HERE';

  res.json({
    status: isConfigured ? 'configured' : 'not-configured',
    message: isConfigured 
      ? 'Spotify integration ready' 
      : 'Configure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env',
    cached_token: spotifyTokenCache ? 'yes' : 'no',
    token_expires_in: spotifyTokenCache 
      ? Math.floor((spotifyTokenExpireTime - Date.now()) / 1000) 
      : 'N/A'
  });
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
  console.log(`📊 Endpoints available:`);
  console.log(`   POST /chat - AI chat endpoint`);
  console.log(`   GET /history/:userId - Chat history`);
  console.log(`   POST /tts - Text-to-speech`);
  console.log(`   GET /api/spotify/token - Get Spotify token`);
  console.log(`   GET /api/spotify/search - Search songs`);
  console.log(`   GET /api/spotify/health - Spotify health check`);
});
