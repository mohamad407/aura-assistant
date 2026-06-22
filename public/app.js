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
document.getElementById('logout-btn').addEventListener('click', () => window.firebaseAuth.signOut(window.firebaseAuth.auth));

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
let wakeModeEnabled = false;

if (recognition) {
    recognition.continuous = true; // Must be true to keep listening for the wake word
    recognition.interimResults = true; // We need interim results to catch the wake word fast
    recognition.lang = 'en-IN'; 
}

// --- HANDS-FREE TOGGLE LOGIC ---
document.getElementById('wakeModeToggle').addEventListener('change', (e) => {
    wakeModeEnabled = e.target.checked;
    if (wakeModeEnabled) {
        // Start listening immediately
        if (recognition && !isListening && !isProcessing && !isSpeaking) {
            recognition.start();
        }
        updateBubble("Hands-Free Active. Say 'AURA'...");
        speechBubble.classList.add('active');
    } else {
        // Stop listening
        if (isListening) recognition.stop();
        speechBubble.classList.remove('active');
    }
});

// --- SPEECH RECOGNITION EVENT HANDLERS ---
if (recognition) {
    recognition.onstart = () => {
        isListening = true;
        if (!wakeModeEnabled) {
            setAuraState('listening');
            updateBubble("Listening...");
        }
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        transcript = transcript.toLowerCase().trim();

        // WAKE WORD DETECTION
        if (wakeModeEnabled) {
            // Check if the user said "aura"
            if (transcript.includes('aura')) {
                // Extract the command after the word "aura"
                let command = transcript.split('aura')[1].trim();
                
                if (command.length > 0) {
                    // User said "AURA, what is the weather"
                    recognition.stop(); // Stop listening to process command
                    addMessageToUI('user', command);
                    sendToAI(command);
                } else {
                    // User just said "AURA"
                    recognition.stop();
                    setAuraState('listening');
                    updateBubble("Yes? I'm listening...");
                    
                    // Restart recognition to catch the actual command
                    setTimeout(() => {
                        if (wakeModeEnabled && !isProcessing) recognition.start();
                    }, 500);
                }
            }
        } else {
            // NORMAL TAP-TO-SPEAK MODE
            if (event.results[event.results.length - 1].isFinal) {
                addMessageToUI('user', transcript);
                sendToAI(transcript);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Recognition error:", event.error);
        if (!wakeModeEnabled) {
            updateBubble("Mic Error");
            setAuraState('idle');
        }
    };

    recognition.onend = () => {
        isListening = false;
        
        // If Hands-Free mode is on, automatically restart listening
        if (wakeModeEnabled && !isProcessing && !isSpeaking) {
            try {
                recognition.start();
            } catch (e) {
                console.log("Restarting recognition...");
            }
        } else if (!isProcessing && !isSpeaking) {
            setAuraState('idle');
        }
    };
}

// Update the AURA ROBOT CLICK EVENT to handle Hands-Free mode
auraRobot.addEventListener('click', () => {
    if (!CURRENT_USER_ID) return alert("Please login first.");
    
    // If hands-free is on, tapping the orb turns it off
    if (wakeModeEnabled) {
        document.getElementById('wakeModeToggle').checked = false;
        document.getElementById('wakeModeToggle').dispatchEvent(new Event('change'));
        return;
    }

    if (isListening || isProcessing || isSpeaking) {
        if (isListening) recognition.stop();
        if (isSpeaking) { audioPlayer.pause(); if (window.speechSynthesis) window.speechSynthesis.cancel(); }
        setAuraState('idle');
        return;
    }
    
    if (recognition) recognition.start();
});


