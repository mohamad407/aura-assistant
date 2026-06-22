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

// Audio Player for Cloud TTS
let audioPlayer = new Audio();

// --- TAB NAVIGATION ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active from all
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Hide all views
        document.querySelectorAll('.view-container').forEach(view => view.style.display = 'none');
        
        // Show selected view
        const tab = btn.getAttribute('data-tab');
        document.getElementById(`view-${tab}`).style.display = 'block';
        
        // If switching to history, refresh it
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
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        
        let desc = "Clear";
        if (code >= 51 && code <= 67) desc = "Rain";
        else if (code >= 71 && code <= 77) desc = "Snow";
        else if (code >= 80 && code <= 82) desc = "Showers";
        else if (code >= 95) desc = "Storm";
        
        document.getElementById('weather-temp').textContent = `${temp}°`;
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
            } else { alert(error.message); }
        });
});

document.getElementById('google-btn').addEventListener('click', () => {
    window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
        .catch(err => alert(err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
    window.firebaseAuth.signOut(window.firebaseAuth.auth);
});

window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
    if (user) {
        CURRENT_USER_ID = user.uid;
        authScreen.style.display = 'none';
        appContainer.style.display = 'flex';
    } else {
        CURRENT_USER_ID = null;
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; 
}

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
            headerDiv.textContent = dateLabel;
            groupDiv.appendChild(headerDiv);

            groups[dateLabel].forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `history-msg ${msg.role}`;
                const shortText = msg.text.substring(0, 200) + (msg.text.length > 200 ? '...' : '');
                msgDiv.innerHTML = `<span class="history-role">${msg.role}</span>${shortText}`;
                groupDiv.appendChild(msgDiv);
            });

            sessionHistory.appendChild(groupDiv);
        }

    } catch (error) {
        console.error("Error loading history:", error);
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

// --- UNIVERSAL CLOUD VOICE ENGINE ---
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
        };

        await audioPlayer.play().catch(e => {
            console.error("Browser blocked autoplay:", e);
            useFallbackVoice(text, langPrefix);
        });
        
    } catch (error) {
        console.error("Cloud Voice Error. Falling back to local voice:", error.message);
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
        
        if (!response.ok) throw new Error(`Backend returned status: ${response.status}`);

        const data = await response.json();
        const aiReply = data.reply || "I'm sorry, I didn't get that.";
        
        addMessageToUI('assistant', aiReply);
        isProcessing = false;
        
        await speakResponse(aiReply);
        
    } catch (error) {
        console.error("Error fetching AI:", error);
        addMessageToUI('assistant', "Connection to the AI network was lost. Please try again.");
        updateBubble("Connection Error");
        setAuraState('idle');
        isProcessing = false;
    }
}

// --- SPEECH RECOGNITION HANDLERS ---
if (recognition) {
    recognition.onstart = () => {
        isListening = true;
        setAuraState('listening');
        updateBubble("Listening...");
    };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        addMessageToUI('user', transcript);
        sendToAI(transcript);
    };
    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        updateBubble("Mic Error");
        setAuraState('idle');
    };
    recognition.onend = () => {
        isListening = false;
        if (!isProcessing && !isSpeaking) setAuraState('idle');
    };
}

// --- AURA ROBOT CLICK EVENT ---
auraRobot.addEventListener('click', () => {
    if (!CURRENT_USER_ID) return alert("Please login first.");
    
    if (isListening || isProcessing || isSpeaking) {
        if (isListening) recognition.stop();
        if (isSpeaking) {
            audioPlayer.pause();
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        }
        setAuraState('idle');
        return;
    }
    
    if (recognition) recognition.start();
});

setAuraState('idle');
