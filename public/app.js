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

// --- FIREBASE AUTH EVENTS ---

// Handle Email/Password Sign Up or Login
document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    
    if (!email || !password) return alert("Please enter email and password");

    // Try to sign in. If user doesn't exist, sign them up.
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

// Handle Google Login
document.getElementById('google-btn').addEventListener('click', () => {
    window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, window.firebaseAuth.provider)
        .catch(err => alert(err.message));
});

// Handle Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    window.firebaseAuth.signOut(window.firebaseAuth.auth);
});

// Auth State Observer (Triggers automatically when user logs in or out)
window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, (user) => {
    if (user) {
        // User is logged in!
        CURRENT_USER_ID = user.uid; // Use Firebase UID for MongoDB
        authScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        loadHistory(); // Fetch this user's chat history from MongoDB
    } else {
        // User is logged out!
        CURRENT_USER_ID = null;
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        historyContainer.innerHTML = ''; // Clear UI
    }
});


// --- SPEECH RECOGNITION SETUP ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
} else {
    alert("Your browser doesn't support Speech Recognition. Please use Chrome or Edge.");
}


// --- MONGODB HISTORY MANAGEMENT (via Backend API) ---

async function loadHistory() {
    if (!CURRENT_USER_ID) return;
    try {
        // ✅ FIXED: Using your live Render backend URL
        const response = await fetch(`https://aura-assistant-34ri.onrender.com/history/${CURRENT_USER_ID}`);
        const history = await response.json();
        
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

function updateBubble(text) { 
    bubbleText.textContent = text; 
}


// --- VOICE OUTPUT (Text-to-Speech) ---

function speakResponse(text) {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    
    utterance.onstart = () => {
        isSpeaking = true;
        setAuraState('speaking');
        updateBubble("🔊 Speaking...");
    };
    
    utterance.onend = () => {
        isSpeaking = false;
        setAuraState('idle');
    };

    window.speechSynthesis.speak(utterance);
}


// --- SEND TO MULTI-AI BACKEND ---

async function sendToAI(text) {
    setAuraState('processing');
    updateBubble("⚙️ Consulting 15+ AIs..."); // Multi-AI Consensus UI update
    
    try {
        // ✅ FIXED: Using your live Render backend URL
        const response = await fetch('https://aura-assistant-34ri.onrender.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, userId: CURRENT_USER_ID })
        });
        
        const data = await response.json();
        const aiReply = data.reply || "I'm sorry, I didn't get that.";
        
        addMessageToUI('assistant', aiReply);
        speakResponse(aiReply);
        
    } catch (error) {
        console.error("Error fetching AI:", error);
        updateBubble("⚠️ Connection Error");
        setAuraState('idle');
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
    
    // If AURA is busy, force stop everything
    if (isListening || isProcessing || isSpeaking) {
        if (isListening) recognition.stop();
        if (isSpeaking) window.speechSynthesis.cancel();
        setAuraState('idle');
        return;
    }
    
    // Start listening
    if (recognition) {
        recognition.start();
    }
});

// Initialize default state on load
setAuraState('idle');
