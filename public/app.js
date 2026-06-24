// ==========================================
// 🎙️ AURA VOICE ASSISTANT - COMPLETE CODE
// ==========================================
// Siri-like continuous listening + Spotify integration
// Updated: June 2026

// DOM Elements
const auraRobot = document.getElementById('auraRobot');
const speechBubble = document.getElementById('speechBubble');
const bubbleText = document.getElementById('bubbleText');
const historyContainer = document.getElementById('historyContainer');
const sessionHistory = document.getElementById('sessionHistory');
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');

// State Management
let isListening = false;
let isProcessing = false;
let isSpeaking = false;
let CURRENT_USER_ID = null;
let audioPlayer = new Audio();

// Wake word state
let wakeWordActive = false;
let wakeRecognition = null;
let commandRecognition = null;
let wakeWordRetryCount = 0;
let continuousListeningMode = false;
let recognitionActive = false;

// ==========================================
// 🗺️ APP LAUNCHER MAP
// ==========================================
const APP_URLS = {
  // Video / Entertainment
  youtube:    'https://www.youtube.com',
  netflix:    'https://www.netflix.com',
  primevideo: 'https://www.primevideo.com',
  hotstar:    'https://www.hotstar.com',
  jiocinema:  'https://www.jiocinema.com',

  // Music
  spotify:    'https://open.spotify.com',
  'apple music': 'https://music.apple.com',
  'youtube music': 'https://music.youtube.com',
  gaana:      'https://gaana.com',
  jiosaavn:   'https://www.jiosaavn.com',
  wynk:       'https://wynk.in',

  // Social / Messaging
  whatsapp:   'https://web.whatsapp.com',
  telegram:   'https://web.telegram.org',
  instagram:  'https://www.instagram.com',
  twitter:    'https://twitter.com',
  facebook:   'https://www.facebook.com',
  snapchat:   'https://www.snapchat.com',
  linkedin:   'https://www.linkedin.com',

  // Productivity / Google
  gmail:      'https://mail.google.com',
  maps:       'https://maps.google.com',
  'google maps': 'https://maps.google.com',
  drive:      'https://drive.google.com',
  docs:       'https://docs.google.com',
  sheets:     'https://sheets.google.com',
  meet:       'https://meet.google.com',
  calendar:   'https://calendar.google.com',
  translate:  'https://translate.google.com',

  // Shopping
  amazon:     'https://www.amazon.in',
  flipkart:   'https://www.flipkart.com',
  meesho:     'https://www.meesho.com',

  // Payments
  gpay:       'https://pay.google.com',
  phonepe:    'https://www.phonepe.com',
  paytm:      'https://www.paytm.com',

  // News
  news:       'https://news.google.com',

  // Other
  github:     'https://github.com',
  stackoverflow: 'https://stackoverflow.com',
  reddit:     'https://www.reddit.com',
  chatgpt:    'https://chat.openai.com',
};

// ==========================================
// 🎵 PLAY SONG — COMPLETE FIXED CODE
// ==========================================

async function handlePlaySongEnhanced(transcript) {
  console.log("🎵 handlePlaySongEnhanced called with:", transcript);
  
  const lower = transcript.toLowerCase();
  let platform = 'spotify';  // Default platform
  let songQuery = '';

  // ✅ STEP 1: Detect platform (on spotify, on youtube, etc.)
  if (lower.includes(' on jiosaavn') || lower.includes(' in jiosaavn')) {
    platform = 'jiosaavn';
  } else if (lower.includes(' on gaana') || lower.includes(' in gaana')) {
    platform = 'gaana';
  } else if (lower.includes(' on youtube music') || lower.includes(' in youtube music')) {
    platform = 'youtube_music';
  } else if (lower.includes('youtube music')) {
    platform = 'youtube_music';
  } else if (lower.includes('youtube')) {
    platform = 'youtube';
  }

  // ✅ STEP 2: Extract song name - FIXED REGEX
  songQuery = lower
    .replace(/^play\s+/i, '')              // Remove "play" from start
    .replace(/\s+(on|in)\s+/gi, ' ')       // Remove "on/in" (all occurrences)
    .replace(/\s+song\s*$/i, '')           // Remove "song" from end
    .replace(/spotify|youtube|gaana|jiosaavn|youtube music/gi, '') // Remove platform names
    .trim();

  console.log("📝 Extracted song query:", songQuery);
  console.log("📱 Platform detected:", platform);

  if (!songQuery || songQuery.length < 2) {
    const msg = "Please tell me what song you want to play! 🎵";
    console.log("❌ Song query too short or empty");
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // ✅ SPOTIFY FLOW
  if (platform === 'spotify') {
    console.log("🎵 Playing on Spotify...");
    
    try {
      // Get token from backend
      console.log("🔑 Fetching Spotify token...");
      const tokenResponse = await fetch('http://localhost:3000/api/spotify/token');
      
      if (!tokenResponse.ok) {
        throw new Error(`Token error: ${tokenResponse.status}`);
      }
      
      const { accessToken } = await tokenResponse.json();
      console.log("✅ Token received");
      
      // Search Spotify
      console.log(`🔍 Searching Spotify for: "${songQuery}"`);
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(songQuery)}&type=track&limit=1`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      
      const searchData = await searchResponse.json();
      
      if (!searchData.tracks || !searchData.tracks.items || searchData.tracks.items.length === 0) {
        console.log("❌ Song not found on Spotify");
        const msg = `Sorry, I couldn't find "${songQuery}" on Spotify`;
        addMessageToUI('assistant', msg);
        speakResponse(msg);
        return true;
      }
      
      const track = searchData.tracks.items[0];
      const trackName = track.name;
      const artistName = track.artists[0].name;
      
      console.log(`✅ Found song: "${trackName}" by ${artistName}`);
      
      // Tell user and open Spotify
      const msg = `🎵 Now playing "${trackName}" by ${artistName} on Spotify!`;
      addMessageToUI('assistant', msg);
      speakResponse(msg);
      
      // ✅ OPEN SPOTIFY WITH CORRECT SONG QUERY
      setTimeout(() => {
        const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(songQuery)}`;
        console.log("📱 Opening Spotify URL:", spotifySearchUrl);
        
        try {
          const newWindow = window.open(spotifySearchUrl, '_blank');
          if (!newWindow) {
            console.warn("Popup blocked, trying alternative");
            window.location.href = spotifySearchUrl;
          }
        } catch (e) {
          console.error("Error opening Spotify:", e);
          window.location.href = spotifySearchUrl;
        }
      }, 1500);
      
      return true;
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      
      // Fallback: Open search anyway with the song query
      const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(songQuery)}`;
      console.log("🔄 Fallback: Opening Spotify search with:", songQuery);
      
      const msg = `🎵 Opening Spotify for "${songQuery}"`;
      addMessageToUI('assistant', msg);
      speakResponse(msg);
      
      setTimeout(() => {
        window.open(spotifySearchUrl, '_blank');
      }, 1200);
      
      return true;
    }
  }
  
  // ✅ OTHER PLATFORMS (YouTube, Gaana, JioSaavn, etc.)
  let url = '';
  let platformName = '';

  if (platform === 'jiosaavn') {
    url = `https://www.jiosaavn.com/search/${encodeURIComponent(songQuery)}`;
    platformName = 'JioSaavn';
  } else if (platform === 'gaana') {
    url = `https://gaana.com/search/${encodeURIComponent(songQuery)}`;
    platformName = 'Gaana';
  } else if (platform === 'youtube_music') {
    url = `https://music.youtube.com/search?q=${encodeURIComponent(songQuery)}`;
    platformName = 'YouTube Music';
  } else if (platform === 'youtube') {
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(songQuery)}`;
    platformName = 'YouTube';
  }

  const msg = `🎵 Opening "${songQuery}" on ${platformName}!`;
  addMessageToUI('assistant', msg);
  speakResponse(msg);
  
  setTimeout(() => {
    console.log("📱 Opening:", url);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      window.location.href = url;
    }
  }, 1200);
  
  return true;
}

// ==========================================
// 📱 OPEN APP — Smart detection
// ==========================================
function handleOpenApp(transcript) {
  const lower = transcript.toLowerCase().trim();

  // Check creator information
  if (
    lower.includes("who discovered you") ||
    lower.includes("who created you") ||
    lower.includes("who made you")
  ) {
    const msg =
      "I was created by Mohammed Asif on June 22, 2026. I am Aura, powered by more than 15 AI models working together.";
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // Sort by longest key first to avoid partial matches
  const sortedApps = Object.entries(APP_URLS).sort((a, b) => b[0].length - a[0].length);

  for (const [appName, url] of sortedApps) {
    const appPattern = new RegExp(`\\b${appName}\\b`, 'i');
    if (appPattern.test(lower)) {
      const displayName = appName.charAt(0).toUpperCase() + appName.slice(1);
      const msg = `🚀 Opening ${displayName}!`;
      addMessageToUI('assistant', msg);
      speakResponse(msg);
      setTimeout(() => {
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          console.warn("Popup blocked, trying alternate method");
          window.location.href = url;
        }
      }, 1000);
      return true;
    }
  }
  return false;
}

// ==========================================
// 🔍 LOCAL COMMAND HANDLER
// ==========================================
function handleLocalCommands(transcript) {
  if (!transcript || transcript.trim().length === 0) return false;

  const lower = transcript.toLowerCase().trim();

  console.log(`📝 Processing command: "${lower}"`);

  // ✅ STOP COMMAND
  if (lower === "stop" || lower === "stop listening" || lower === "quit") {
    console.log("🛑 Stop command detected");
    continuousListeningMode = false;
    const msg = "Okay, stopping. Say Aura to wake me again!";
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // Greetings
  if (lower === "hi" || lower === "hello" || lower === "hey") {
    const msg = "Hello! How are you today?";
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // How are you
  if (lower.includes("how are you")) {
    const msg = "I'm doing great. How can I help you?";
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // Creator information
  if (
    lower.includes("who discovered you") ||
    lower.includes("who created you") ||
    lower.includes("who made you")
  ) {
    const msg =
      "I was created by Mohammed Asif on June 22, 2026. I am Aura, powered by more than 15 AI models working together.";
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    return true;
  }

  // Call command
  if (lower.startsWith("call ")) {
    const person = lower.replace("call ", "").trim();
    const msg = `Calling ${person}`;
    addMessageToUI('assistant', msg);
    speakResponse(msg);
    window.location.href = `tel:${person}`;
    return true;
  }

  // ✅ PLAY SONG COMMAND - USES FIXED FUNCTION
  const playPatterns = [
    /^play\s+.+/i,
    /^play\s+.+\s+song/i,
    /play\s+(?:me\s+)?(.+)(?:\s+song)?/i
  ];

  if (playPatterns.some(p => p.test(lower))) {
    console.log("✅ Matched PLAY pattern");
    return handlePlaySongEnhanced(transcript);  // ✅ USE FIXED FUNCTION
  }

  // Open app command
  const openPatterns = [
    /^open\s+/i,
    /^launch\s+/i,
    /^start\s+/i,
    /^go to\s+/i,
    /^take me to\s+/i,
    /^switch to\s+/i,
    /^show me\s+/i
  ];

  if (openPatterns.some(p => p.test(lower))) {
    console.log("✅ Matched OPEN pattern");
    const handled = handleOpenApp(lower);
    if (handled) return true;
  }

  // Direct app names
  for (const appName of Object.keys(APP_URLS)) {
    const exactPattern = new RegExp(`^${appName}$`, 'i');
    if (exactPattern.test(lower)) {
      console.log(`✅ Matched app name: ${appName}`);
      return handleOpenApp(appName);
    }
  }

  console.log("❌ No local command matched, sending to AI");
  return false;
}

// ==========================================
// 🎙️ WAKE WORD ENGINE
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupWakeWordListener() {
  if (!SpeechRecognition) {
    console.error("❌ Speech Recognition API not supported");
    return;
  }

  console.log("🔔 Setting up wake word listener...");

  wakeRecognition = new SpeechRecognition();
  wakeRecognition.continuous = true;
  wakeRecognition.interimResults = true;
  wakeRecognition.lang = 'en-IN';

  wakeRecognition.onstart = () => {
    console.log("🎙️ Wake word listener started");
    wakeWordRetryCount = 0;
  };

  wakeRecognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();

      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    const allText = (finalTranscript + interimTranscript).toLowerCase();
    console.log(`🎙️ Wake word interim: "${allText}"`);

    // Check for wake word "aura"
    const wakeWordPatterns = [
      /\baura\b/i,
      /\bawra\b/i,
      /\bora\b/i,
      /^aura/i,
      /aura$/i
    ];

    const wakeWordDetected = wakeWordPatterns.some(pattern => pattern.test(allText));

    if (wakeWordDetected) {
      if (!isListening && !isProcessing && !isSpeaking && CURRENT_USER_ID) {
        console.log('✅ Wake word "AURA" DETECTED!');
        try {
          wakeRecognition.stop();
        } catch(e) {}
        
        speakResponse("Yes");
        
        setTimeout(() => {
          continuousListeningMode = true;
          triggerCommandListening();
        }, 1200);
      }
    }
  };

  wakeRecognition.onend = () => {
    console.log("🔴 Wake word listener ended");
    if (!isListening && !isProcessing && !isSpeaking && CURRENT_USER_ID && wakeWordActive && !continuousListeningMode) {
      console.log("🔄 Restarting wake word listener...");
      setTimeout(() => {
        try { 
          wakeRecognition.start(); 
          wakeWordRetryCount = 0;
        } catch(e) {
          console.error("Failed to restart wake word:", e.message);
          if (wakeWordRetryCount < 3) {
            wakeWordRetryCount++;
            setTimeout(setupWakeWordListener, 2000);
          }
        }
      }, 500);
    }
  };

  wakeRecognition.onerror = (e) => {
    console.error("🔴 Wake word error:", e.error);
    if (e.error !== 'no-speech' && e.error !== 'network') {
      setTimeout(() => {
        if (!isListening && CURRENT_USER_ID && wakeWordActive) {
          try { 
            wakeRecognition.start(); 
          } catch(err) {
            console.error("Error restarting:", err);
          }
        }
      }, 2000);
    }
  };

  try { 
    wakeRecognition.start(); 
    wakeWordActive = true;
    console.log("✅ Wake word listener activated");
  } catch(e) {
    console.error("Failed to start wake word listener:", e.message);
  }
}

function triggerCommandListening() {
  if (recognitionActive) {
    console.log("⚠️ Recognition already running");
    return;
  }

  recognitionActive = true;
  console.log("🎤 Triggering command listening... (Continuous: " + continuousListeningMode + ")");

  showWakeWordIndicator(true);
  updateBubble("Listening for your command... 👂");
  speechBubble.classList.add('active');
  auraRobot.classList.add('listening');

  commandRecognition = new SpeechRecognition();
  commandRecognition.continuous = false;
  commandRecognition.interimResults = false;
  commandRecognition.lang = 'en-IN';

  commandRecognition.onstart = () => {
    isListening = true;
    setAuraState('listening');
    updateBubble("Listening... 👂");
    console.log("🎤 Command listening started");
  };

  commandRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log(`📝 Command transcript: "${transcript}"`);

    addMessageToUI('user', transcript);

    isListening = false;
    recognitionActive = false;

    const handled = handleLocalCommands(transcript);

    if (!handled) {
      console.log("📤 Sending to AI backend...");
      sendToAI(transcript);
    }
  };

  commandRecognition.onerror = (e) => {
    console.error("Command recognition error:", e.error);
    recognitionActive = false;
    isListening = false;

    if (e.error === "aborted") {
      return;
    }

    restartAfterCommand();
  };

  try { 
    commandRecognition.start(); 
  } catch(e) {
    console.error("Failed to start command listening:", e.message);
  }
}

function restartAfterCommand() {
  if (continuousListeningMode) {
    console.log("🔄 Continuous mode: restarting listening...");
    setTimeout(() => {
      recognitionActive = false;
      triggerCommandListening();
    }, 500);
  } else {
    console.log("🔄 Normal mode: restarting wake word...");
    restartWakeWord();
  }
}

function restartWakeWord() {
  console.log("🔄 Restarting wake word listening...");
  showWakeWordIndicator(false);
  continuousListeningMode = false;
  if (CURRENT_USER_ID && wakeWordActive) {
    setTimeout(() => {
      try { 
        if (wakeRecognition) wakeRecognition.start();
      } catch(e) {
        console.error("Error restarting wake word:", e.message);
        setTimeout(setupWakeWordListener, 1000);
      }
    }, 800);
  }
}

function showWakeWordIndicator(active) {
  const indicator = document.getElementById('wakeWordIndicator');
  if (indicator) indicator.classList.toggle('active', active);
}

// --- TAB NAVIGATION ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view-container').forEach(view => view.style.display = 'none');
    const tab = btn.getAttribute('data-tab');
    document.getElementById(`view-${tab}`).style.display = 'block';
    if (tab === 'history') loadHistory();
  });
});

// --- LIVE TIME & WEATHER WIDGET ---
function updateTime() {
  const now = new Date();
  document.getElementById('live-time').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  document.getElementById('live-date').textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function loadWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=79.1573&current_weather=true');
    const data = await res.json();
    document.getElementById('weather-temp').textContent = `${Math.round(data.current_weather.temperature)}°`;
    let desc = "Clear";
    if (data.current_weather.weathercode >= 51) desc = "Rain";
    document.getElementById('weather-desc').textContent = desc;
  } catch(e) { 
    document.getElementById('weather-desc').textContent = "N/A"; 
  }
}

updateTime();
loadWeather();
setInterval(updateTime, 1000);
setInterval(loadWeather, 600000);

// --- FIREBASE AUTH EVENTS ---
document.getElementById('signup-btn').addEventListener('click', () => {
  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;
  if (!email || !password) return alert("Please enter email and password");
  
  window.firebaseAuth.signInWithEmailAndPassword(window.firebaseAuth.auth, email, password)
    .catch((error) => {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        window.firebaseAuth.createUserWithEmailAndPassword(window.firebaseAuth.auth, email, password)
          .catch(err => alert(err.message));
      } else { 
        alert(error.message); 
      }
    });
});

document.getElementById('google-btn').addEventListener('click', () => {
  window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
    .catch(err => alert(err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
  wakeWordActive = false;
  continuousListeningMode = false;
  try { wakeRecognition && wakeRecognition.stop(); } catch(e) {}
  window.firebaseAuth.signOut(window.firebaseAuth.auth);
});

window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
  if (user) {
    CURRENT_USER_ID = user.uid;
    authScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    console.log(`✅ User logged in: ${user.email}`);
    setTimeout(() => {
      console.log("Starting wake word listener after login...");
      setupWakeWordListener();
    }, 1500);
  } else {
    CURRENT_USER_ID = null;
    wakeWordActive = false;
    continuousListeningMode = false;
    try { wakeRecognition && wakeRecognition.stop(); } catch(e) {}
    authScreen.style.display = 'flex';
    appContainer.style.display = 'none';
    console.log("User logged out");
  }
});

// --- MONGODB HISTORY MANAGEMENT ---
async function loadHistory() {
  if (!CURRENT_USER_ID) return;
  try {
    sessionHistory.innerHTML = '<div class="empty-state small"><p>Loading history...</p></div>';
    const response = await fetch(`https://aura-assistant-34ri.onrender.com/history/${CURRENT_USER_ID}`);
    const history = await response.json();
    
    if (!Array.isArray(history) || history.length === 0) {
      sessionHistory.innerHTML = '<div class="empty-state small"><p>No conversation history yet.</p></div>';
      return;
    }
    
    sessionHistory.innerHTML = '';
    const groups = {};
    const today = new Date().setHours(0,0,0,0);
    const yesterday = today - (24 * 60 * 60 * 1000);

    history.forEach(msg => {
      const d = new Date(msg.timestamp).setHours(0,0,0,0);
      let label;
      if (d === today) label = "Today";
      else if (d === yesterday) label = "Yesterday";
      else label = new Date(msg.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(msg);
    });

    for (const dateLabel in groups) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'history-day-group';
      
      const headerDiv = document.createElement('div');
      headerDiv.className = 'history-day-header';
      headerDiv.textContent = `📅 ${dateLabel}`;
      
      headerDiv.addEventListener('click', () => {
        historyContainer.innerHTML = '';
        groups[dateLabel].forEach(m => addMessageToUI(m.role, m.text));
        document.querySelector('.tab-btn[data-tab="chat"]').click();
      });
      
      groupDiv.appendChild(headerDiv);

      groups[dateLabel].forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `history-msg ${msg.role}`;
        const shortText = msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : '');
        msgDiv.innerHTML = `<span class="history-role">${msg.role}</span>${shortText}`;
        groupDiv.appendChild(msgDiv);
      });

      sessionHistory.appendChild(groupDiv);
    }
  } catch (error) {
    console.error("History load error:", error);
    sessionHistory.innerHTML = '<div class="empty-state small"><p>Error loading history.</p></div>';
  }
}

function addMessageToUI(role, text) {
  const emptyState = historyContainer.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', role);
  msgDiv.textContent = text;
  historyContainer.appendChild(msgDiv);
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

// --- AURA ROBOT ANIMATIONS & STATES ---
function setAuraState(state) {
  auraRobot.classList.remove('listening', 'processing', 'speaking');
  if (state === 'idle') {
    speechBubble.classList.remove('active');
  } else {
    auraRobot.classList.add(state);
    speechBubble.classList.add('active');
  }
}

function updateBubble(text) { 
  bubbleText.textContent = text; 
}

// --- LANGUAGE DETECTION ---
function detectLanguage(text) {
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  if (/[àâäçéèêëîïôöùûü]/i.test(text)) return 'fr';
  if (/[ñ¿¡]/i.test(text)) return 'es';
  if (/[äöüß]/i.test(text)) return 'de';
  return 'en';
}

async function speakResponse(text) {
  if (!text) return;
  
  audioPlayer.pause();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  
  const langPrefix = detectLanguage(text);
  setAuraState('processing');
  updateBubble("Generating voice...");

  try {
    const response = await fetch('https://aura-assistant-34ri.onrender.com/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: langPrefix })
    });
    
    if (response.status === 204 || !response.ok) throw new Error("Cloud TTS unavailable");
    
    const blob = await response.blob();
    if (blob.size < 100) throw new Error("Audio file is empty");

    const audioUrl = URL.createObjectURL(blob);
    audioPlayer.src = audioUrl;
    
    audioPlayer.onplay = () => { 
      isSpeaking = true; 
      setAuraState('speaking'); 
      updateBubble("Speaking..."); 
    };
    
    audioPlayer.onended = () => {
      isSpeaking = false;
      setAuraState('idle');

      if (continuousListeningMode) {
        console.log("🔄 Continuous mode: restarting listening...");
        setTimeout(() => {
          recognitionActive = false;
          triggerCommandListening();
        }, 500);
      } else {
        restartWakeWord();
      }
    };
    
    await audioPlayer.play().catch(e => useFallbackVoice(text, langPrefix));
  } catch (error) {
    console.error("Cloud Voice Error:", error.message);
    useFallbackVoice(text, langPrefix);
  }
}

function useFallbackVoice(text, langPrefix) {
  if (!window.speechSynthesis) { 
    updateBubble("Voice Error"); 
    setAuraState('idle'); 
    return; 
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langPrefix === 'en' ? 'en-US' : langPrefix;
  
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(langPrefix));
  if (matchedVoice) utterance.voice = matchedVoice;
  
  utterance.onstart = () => { 
    isSpeaking = true; 
    setAuraState('speaking'); 
    updateBubble("Speaking..."); 
  };
  
  utterance.onend = () => {
    isSpeaking = false;
    setAuraState('idle');

    if (continuousListeningMode) {
      console.log("🔄 Continuous mode: restarting listening...");
      setTimeout(() => {
        recognitionActive = false;
        triggerCommandListening();
      }, 500);
    } else {
      restartWakeWord();
    }
  };
  
  window.speechSynthesis.speak(utterance);
}

// --- SEND TO MULTI-AI BACKEND ---
async function sendToAI(text) {
  isProcessing = true;
  setAuraState('processing');
  updateBubble("Consulting AIs...");
  
  try {
    const response = await fetch('https://aura-assistant-34ri.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, userId: CURRENT_USER_ID })
    });
    
    if (!response.ok) throw new Error(`Backend error: ${response.status}`);
    
    const data = await response.json();
    let aiReply = data.reply || "I'm sorry, I didn't get that.";
    
    console.log(`📤 AI Reply received (${aiReply.length} chars)`);
    
    // ACTION PARSER
    if (aiReply.includes("ACTION: URL:")) {
      const urlMatch = aiReply.match(/ACTION:\s*URL:\s*([^\s\n]+)/i);
      if (urlMatch && urlMatch[1]) {
        const actionUrl = urlMatch[1].trim();
        
        let friendlyMsg = "Opening the requested application...";
        if (actionUrl.startsWith("tel:")) friendlyMsg = "Opening your phone dialer...";
        if (actionUrl.startsWith("sms:")) friendlyMsg = "Opening your messaging app...";
        if (actionUrl.includes("youtube.com")) friendlyMsg = "Opening YouTube...";
        if (actionUrl.includes("whatsapp.com")) friendlyMsg = "Opening WhatsApp...";
        if (actionUrl.includes("spotify.com")) friendlyMsg = "Opening Spotify...";
        
        addMessageToUI('assistant', friendlyMsg);
        await speakResponse(friendlyMsg);
        setTimeout(() => { 
          const newWindow = window.open(actionUrl, '_blank');
          if (!newWindow) {
            window.location.href = actionUrl;
          }
        }, 1000);
        isProcessing = false;
        return;
      }
    }
    
    addMessageToUI('assistant', aiReply);
    isProcessing = false;
    await speakResponse(aiReply);
    
  } catch (error) {
    console.error("Error fetching AI:", error);
    addMessageToUI('assistant', "Connection lost. Please try again.");
    updateBubble("Error");
    setAuraState('idle');
    isProcessing = false;
    restartAfterCommand();
  }
}

// --- MANUAL ORB CLICK ---
auraRobot.addEventListener('click', () => {
  console.log("📱 Tap detected - starting command listening...");
  try {
    wakeRecognition && wakeRecognition.stop();
  } catch(e) {}

  continuousListeningMode = true;
  triggerCommandListening();
});

// Initial state
setAuraState('idle');
console.log("✅ AURA Voice Agent initialized with Spotify integration");
