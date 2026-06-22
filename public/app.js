// DOM Elements
const auraRobot = document.getElementById('auraRobot');
const speechBubble = document.getElementById('speechBubble');
const bubbleText = document.getElementById('bubbleText');
const historyContainer = document.getElementById('historyContainer');
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');

// State Management
let isListening = false;
let isProcessing = false;
let isSpeaking = false;
let CURRENT_USER_ID = null;

// Audio Player for Cloud TTS
let audioPlayer = new Audio();

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
        loadHistory();
    } else {
        CURRENT_USER_ID = null;
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        historyContainer.innerHTML = '';
    }
});

// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; 
} else {
    alert("Your browser doesn't support Speech Recognition. Please use Chrome or Edge.");
}

// --- MONGODB HISTORY MANAGEMENT ---

async function loadHistory() {
    if (!CURRENT_USER_ID) return;
    try {
        const response = await fetch(`https://aura-assistant-34ri.onrender.com/history/${CURRENT_USER_ID}`);
        const history = await response.json();
        
        // SAFETY CHECK: Ensure history is an array
        if (!Array.isArray(history)) {
            console.error("Expected array but got:", history);
            return;
        }
        
        historyContainer.innerHTML = '';
        history.forEach(msg => addMessageToUI(msg.role, msg.text, false));
        historyContainer.scrollTop = historyContainer.scrollHeight;
    } catch (error) {
        console.error("Error loading history from MongoDB:", error);
    }
}

function addMessageToUI(role, text, save = true) {
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

// --- UNIVERSAL VOICE ENGINE ---

function detectLanguage(text) {
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
    if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
    if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Chinese
    if (/[\u3040-\u30FF]/.test(text)) return 'ja'; // Japanese
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
    if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Russian
    if (/[àâäçéèêëîïôöùûü]/i.test(text)) return 'fr'; // French
    if (/[ñ¿¡]/i.test(text)) return 'es'; // Spanish
    if (/[äöüß]/i.test(text)) return 'de'; // German
    return 'en'; // Default English
}

async function speakResponse(text) {
    if (!text) return;
    
    audioPlayer.pause();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    const langPrefix = detectLanguage(text);
    
    setAuraState('processing');
    updateBubble("🎙️ Generating Voice...");

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
            updateBubble("🔊 Speaking...");
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

// Fallback Local Voice Function (Uses Browser's Built-in Voices)
function useFallbackVoice(text, langPrefix) {
    if (!window.speechSynthesis) {
        updateBubble("⚠️ Voice Error");
        setAuraState('idle');
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langPrefix === 'en' ? 'en-US' : langPrefix;
    
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchedVoice) utterance.voice = matchedVoice;
    
    utterance.onstart = () => { setAuraState('speaking'); updateBubble("🔊 Speaking..."); };
    utterance.onend = () => { setAuraState('idle'); };
    
    window.speechSynthesis.speak(utterance);
}

// --- SEND TO MULTI-AI BACKEND ---

async function sendToAI(text) {
    isProcessing = true;
    setAuraState('processing');
    updateBubble("⚙️ Consulting 5 AIs...");
    
    try {
        const response = await fetch('https://aura-assistant-34ri.onrender.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, userId: CURRENT_USER_ID })
        });
        
        const data = await response.json();
        const aiReply = data.reply || "I'm sorry, I didn't get that.";
        
        addMessageToUI('assistant', aiReply);
        isProcessing = false;
        
        await speakResponse(aiReply);
        
    } catch (error) {
        console.error("Error fetching AI:", error);
        updateBubble("⚠️ Connection Error");
        setAuraState('idle');
        isProcessing = false;
    }
}

// --- SPEECH RECOGNITION EVENT HANDLERS ---

if (recognition) {
    recognition.onstart = () => {
        isListening = true;
        setAuraState('listening');
        updateBubble("🟡 Listening...");
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        addMessageToUI('user', transcript);
        sendToAI(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        updateBubble("⚠️ Mic Error");
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
    
    if (recognition) {
        recognition.start();
    }
});

// Initialize default state on load
setAuraState('idle');
