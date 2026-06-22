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
// 🎵 PLAY SONG — Smart detection
// ==========================================
function handlePlaySong(transcript) {
  // Patterns: "play <song>", "play <song> on spotify/youtube"
  const lower = transcript.toLowerCase();

  let platform = 'youtube'; // default
  let songQuery = '';

  // Detect platform override
  if (lower.includes(' on spotify') || lower.includes(' in spotify')) {
    platform = 'spotify';
  } else if (lower.includes(' on jiosaavn') || lower.includes(' in jiosaavn')) {
    platform = 'jiosaavn';
  } else if (lower.includes(' on gaana') || lower.includes(' in gaana')) {
    platform = 'gaana';
  } else if (lower.includes(' on youtube music') || lower.includes(' in youtube music')) {
    platform = 'youtube_music';
  }

  // Extract song name — strip trigger words
  let cleaned = lower
    .replace(/play\s+/i, '')
    .replace(/\s+on\s+(spotify|youtube|jiosaavn|gaana|youtube music)/i, '')
    .replace(/\s+in\s+(spotify|youtube|jiosaavn|gaana|youtube music)/i, '')
    .replace(/\s+song\s*/i, ' ')
    .trim();

  songQuery = cleaned;

  let url = '';
  let platformName = '';

  if (platform === 'spotify') {
    url = `https://open.spotify.com/search/${encodeURIComponent(songQuery)}`;
    platformName = 'Spotify';
  } else if (platform === 'jiosaavn') {
    url = `https://www.jiosaavn.com/search/${encodeURIComponent(songQuery)}`;
    platformName = 'JioSaavn';
  } else if (platform === 'gaana') {
    url = `https://gaana.com/search/${encodeURIComponent(songQuery)}`;
    platformName = 'Gaana';
  } else if (platform === 'youtube_music') {
    url = `https://music.youtube.com/search?q=${encodeURIComponent(songQuery)}`;
    platformName = 'YouTube Music';
  } else {
    // Default: YouTube
    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(songQuery)}`;
    platformName = 'YouTube';
  }

  const msg = `Playing "${songQuery}" on ${platformName}! 🎵`;
  addMessageToUI('assistant', msg);
  speakResponse(msg);
  setTimeout(() => window.open(url, '_blank'), 1200);
  return true;
}

// ==========================================
// 📱 OPEN APP — Smart detection
// ==========================================
function handleOpenApp(transcript) {
  const lower = transcript.toLowerCase();

  // Direct app name match
  for (const [appName, url] of Object.entries(APP_URLS)) {
    if (lower.includes(appName)) {
      const msg = `Opening ${appName.charAt(0).toUpperCase() + appName.slice(1)}! 🚀`;
      addMessageToUI('assistant', msg);
      speakResponse(msg);
      setTimeout(() => window.open(url, '_blank'), 1000);
      return true;
    }
  }
  return false;
}

// ==========================================
// 🔍 LOCAL COMMAND HANDLER — runs before sending to AI
// ==========================================
function handleLocalCommands(transcript) {
  const lower = transcript.toLowerCase().trim();

  // 1. Play song command
  const playPatterns = [/^play\s+.+/i, /^play\s+.+\s+song/i];
  if (playPatterns.some(p => p.test(lower))) {
    return handlePlaySong(transcript);
  }

  // 2. Open / launch app command
  const openPatterns = [
    /^open\s+/i, /^launch\s+/i, /^start\s+/i,
    /^go to\s+/i, /^take me to\s+/i, /^switch to\s+/i
  ];
  if (openPatterns.some(p => p.test(lower))) {
    const handled = handleOpenApp(lower);
    if (handled) return true;
  }

  // 3. Direct app name (without open keyword)
  // e.g. "YouTube", "Spotify"
  for (const appName of Object.keys(APP_URLS)) {
    if (lower === appName || lower === `open ${appName}`) {
      const handled = handleOpenApp(lower.includes(appName) ? lower : appName);
      if (handled) return true;
    }
  }

  return false; // Not handled locally, send to AI
}

// ==========================================
// 🎙️ WAKE WORD ENGINE — "Aura" trigger
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupWakeWordListener() {
  if (!SpeechRecognition) return;

  wakeRecognition = new SpeechRecognition();
  wakeRecognition.continuous = true;
  wakeRecognition.interimResults = true;
  wakeRecognition.lang = 'en-IN';

  wakeRecognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();
      // Check for wake word "aura"
      if (transcript.includes('aura') || transcript.includes('ora') || transcript.includes('awra')) {
        if (!isListening && !isProcessing && !isSpeaking && CURRENT_USER_ID) {
          console.log('🔔 Wake word detected!');
          wakeRecognition.stop();
          triggerCommandListening();
          break;
        }
      }
    }
  };

  wakeRecognition.onend = () => {
    // Restart wake word listener unless we're in a command session
    if (!isListening && !isProcessing && !isSpeaking && CURRENT_USER_ID) {
      setTimeout(() => {
        try { wakeRecognition.start(); } catch(e) {}
      }, 500);
    }
  };

  wakeRecognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      setTimeout(() => {
        if (!isListening && CURRENT_USER_ID) {
          try { wakeRecognition.start(); } catch(err) {}
        }
      }, 1000);
    }
  };

  try { wakeRecognition.start(); wakeWordActive = true; } catch(e) {}
}

function triggerCommandListening() {
  showWakeWordIndicator(true);
  updateBubble("I'm listening... 👂");
  speechBubble.classList.add('active');

  // Brief beep/visual feedback
  auraRobot.classList.add('listening');

  commandRecognition = new SpeechRecognition();
  commandRecognition.continuous = false;
  commandRecognition.interimResults = false;
  commandRecognition.lang = 'en-IN';

  commandRecognition.onstart = () => {
    isListening = true;
    setAuraState('listening');
    updateBubble("Listening... 👂");
  };

  commandRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    addMessageToUI('user', transcript);
    isListening = false;

    const handled = handleLocalCommands(transcript);
    if (!handled) {
      sendToAI(transcript);
    }
  };

  commandRecognition.onerror = (e) => {
    updateBubble("Didn't catch that. Say 'Aura' again.");
    setAuraState('idle');
    isListening = false;
    restartWakeWord();
  };

  commandRecognition.onend = () => {
    isListening = false;
    showWakeWordIndicator(false);
    if (!isProcessing && !isSpeaking) {
      setAuraState('idle');
      restartWakeWord();
    }
  };

  try { commandRecognition.start(); } catch(e) {}
}

function restartWakeWord() {
  showWakeWordIndicator(false);
  if (CURRENT_USER_ID && wakeWordActive) {
    setTimeout(() => {
      try { wakeRecognition.start(); } catch(e) {}
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
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current_weather=true');
        const data = await res.json();
        document.getElementById('weather-temp').textContent = `${Math.round(data.current_weather.temperature)}°`;
        let desc = "Clear";
        if (data.current_weather.weathercode >= 51) desc = "Rain";
        document.getElementById('weather-desc').textContent = desc;
    } catch(e) { document.getElementById('weather-desc').textContent = "N/A"; }
}
updateTime(); loadWeather();
setInterval(updateTime, 1000); setInterval(loadWeather, 600000);

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
            } else { alert(error.message); }
        });
});
document.getElementById('google-btn').addEventListener('click', () => {
    window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
        .catch(err => alert(err.message));
});
document.getElementById('logout-btn').addEventListener('click', () => {
    wakeWordActive = false;
    try { wakeRecognition && wakeRecognition.stop(); } catch(e) {}
    window.firebaseAuth.signOut(window.firebaseAuth.auth);
});

window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
    if (user) {
        CURRENT_USER_ID = user.uid;
        authScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        // Start wake word listener after login
        setTimeout(() => setupWakeWordListener(), 1000);
    } else {
        CURRENT_USER_ID = null;
        wakeWordActive = false;
        try { wakeRecognition && wakeRecognition.stop(); } catch(e) {}
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
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
function updateBubble(text) { bubbleText.textContent = text; }

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
        audioPlayer.onplay = () => { isSpeaking = true; setAuraState('speaking'); updateBubble("Speaking..."); };
        audioPlayer.onended = () => {
            isSpeaking = false;
            setAuraState('idle');
            restartWakeWord();
        };
        await audioPlayer.play().catch(e => useFallbackVoice(text, langPrefix));
    } catch (error) {
        console.error("Cloud Voice Error. Falling back:", error.message);
        useFallbackVoice(text, langPrefix);
    }
}

function useFallbackVoice(text, langPrefix) {
    if (!window.speechSynthesis) { updateBubble("Voice Error"); setAuraState('idle'); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langPrefix === 'en' ? 'en-US' : langPrefix;
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchedVoice) utterance.voice = matchedVoice;
    utterance.onstart = () => { isSpeaking = true; setAuraState('speaking'); updateBubble("Speaking..."); };
    utterance.onend = () => {
        isSpeaking = false;
        setAuraState('idle');
        restartWakeWord();
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
        
        // ACTION PARSER (Open Apps / Call)
        if (aiReply.includes("ACTION: URL:")) {
            const urlMatch = aiReply.match(/ACTION:\s*URL:\s*([^\s]+)/i);
            if (urlMatch && urlMatch[1]) {
                const actionUrl = urlMatch[1].trim();
                
                let friendlyMsg = "Opening the requested application...";
                if (actionUrl.startsWith("tel:")) friendlyMsg = "Opening your phone dialer...";
                if (actionUrl.startsWith("sms:")) friendlyMsg = "Opening your messaging app...";
                if (actionUrl.includes("youtube.com")) friendlyMsg = "Opening YouTube...";
                if (actionUrl.includes("whatsapp.com")) friendlyMsg = "Opening WhatsApp...";
                
                addMessageToUI('assistant', friendlyMsg);
                await speakResponse(friendlyMsg);
                setTimeout(() => { window.open(actionUrl, '_blank'); }, 1000);
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
        restartWakeWord();
    }
}

// --- MANUAL ORB CLICK (fallback for tap-to-talk) ---
auraRobot.addEventListener('click', () => {
    if (!CURRENT_USER_ID) return alert("Please login first.");

    if (isListening || isProcessing || isSpeaking) {
        if (isListening) {
            try { commandRecognition && commandRecognition.stop(); } catch(e) {}
        }
        if (isSpeaking) {
            audioPlayer.pause();
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        }
        setAuraState('idle');
        isListening = false;
        isSpeaking = false;
        restartWakeWord();
        return;
    }

    // Manual tap triggers command listening directly
    try { wakeRecognition && wakeRecognition.stop(); } catch(e) {}
    triggerCommandListening();
});

setAuraState('idle');
