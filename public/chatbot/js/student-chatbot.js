
/* ========================================
   STUDENT CHATBOT LOGIC
   ======================================== */

var messagesArea;
var messageInput;
var sendBtn;
var typingIndicator;
var myStudentId;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', function () {
    messagesArea     = document.getElementById('messagesArea');
    messageInput     = document.getElementById('messageInput');
    sendBtn          = document.getElementById('sendButton');
    typingIndicator  = document.getElementById('typingIndicator');

    // Give this browser session a persistent student ID
    myStudentId = localStorage.getItem('studentId');
    if (!myStudentId) {
        myStudentId = 'student_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        localStorage.setItem('studentId', myStudentId);
    }

    // ---- BLOCK CHECK ----
    if (isStudentBlocked(myStudentId)) {
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = 'You have been blocked by the team.';
        showMessage(
            '🚫 You have been blocked by the team and cannot send messages. Please contact the club admin directly.',
            'bot',
            new Date().toISOString(),
            true
        );
        return; // stop — don't load anything else
    }

    // Normal startup
    loadHistory();

    sendBtn.addEventListener('click', handleSend);
    messageInput.addEventListener('keypress', function (evt) {
        if (evt.key === 'Enter') handleSend();
    });

    messageInput.focus();

    // Check for new team replies every 10 seconds
    setInterval(checkForNewReplies, 10000);

    console.log('Chatbot ready ✅ studentId:', myStudentId);
});

// ---- LOAD HISTORY ----
function loadHistory() {
    var saved = localStorage.getItem('clubChatMessages');

    if (saved) {
        var msgList = JSON.parse(saved);
        msgList.forEach(function (m) {
            showMessage(m.text, m.sender, m.timestamp, false);
        });
    } else {
        showWelcome();
    }

    scrollDown();
}

// ---- WELCOME ----
function showWelcome() {
    var welcomeText = "Hi! 👋 I'm your club assistant. Ask me anything about joining, events, meetings, or our activities!";

    showMessage(welcomeText, 'bot', new Date().toISOString(), true);

    var welcomeMsg = {
        id: Date.now(),
        text: welcomeText,
        sender: 'bot',
        timestamp: new Date().toISOString()
    };
    saveToHistory(welcomeMsg);
}

// ---- HANDLE SEND ----
function handleSend() {
    var txt = messageInput.value.trim();
    if (txt === '') return;

    // Check block again in case they got blocked mid-session
    if (isStudentBlocked(myStudentId)) {
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = 'You have been blocked by the team.';
        showMessage('🚫 You have been blocked by the team.', 'bot', new Date().toISOString(), true);
        return;
    }

    var userEntry = {
        id: Date.now(),
        text: txt,
        sender: 'user',
        timestamp: new Date().toISOString()
    };

    showMessage(txt, 'user', userEntry.timestamp, true);
    saveToHistory(userEntry);

    messageInput.value = '';
    sendBtn.disabled = true;

    showTyping();

    setTimeout(function () {
        processUserMessage(txt);
    }, 1500);
}

// ---- PROCESS MESSAGE ----
function processUserMessage(questionText) {
    var faqResult = checkFAQ(questionText);
    var botText;

    if (faqResult.matched) {
        botText = faqResult.answer;
        console.log('FAQ matched ✅');
    } else {
        // Save to pending — pass studentId so admin can block if needed
        savePendingQuestion(questionText, myStudentId);
        botText = "Thanks for your question! 🤔 I've forwarded this to our team. They'll get back to you soon!";
        console.log('No FAQ match — saved for team');
    }

    hideTyping();

    var botEntry = {
        id: Date.now(),
        text: botText,
        sender: 'bot',
        timestamp: new Date().toISOString()
    };

    showMessage(botText, 'bot', botEntry.timestamp, true);
    saveToHistory(botEntry);

    sendBtn.disabled = false;
    messageInput.focus();
}

// ---- SHOW MESSAGE IN UI ----
function showMessage(txt, senderType, ts, animate) {
    var wrapper = document.createElement('div');
    wrapper.className = 'message ' + senderType;
    if (animate) wrapper.style.animation = 'slideIn 0.3s ease';

    var avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = senderType === 'user' ? '👤' : '🤖';

    var contentWrap = document.createElement('div');
    contentWrap.className = 'message-content';

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = txt;

    var timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = formatChatTime(ts);

    contentWrap.appendChild(bubble);
    contentWrap.appendChild(timeEl);
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrap);

    messagesArea.appendChild(wrapper);
    scrollDown();
}

// ---- SAVE TO HISTORY ----
function saveToHistory(msgObj) {
    var history = JSON.parse(localStorage.getItem('clubChatMessages') || '[]');
    history.push(msgObj);
    localStorage.setItem('clubChatMessages', JSON.stringify(history));
}

// ---- TYPING INDICATOR ----
function showTyping() {
    typingIndicator.classList.remove('hidden');
    scrollDown();
}

function hideTyping() {
    typingIndicator.classList.add('hidden');
}

// ---- CHECK FOR NEW TEAM REPLIES ----
function checkForNewReplies() {
    // Also re-check block status
    if (isStudentBlocked(myStudentId)) {
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = 'You have been blocked by the team.';
        return;
    }

    var savedMsgs = JSON.parse(localStorage.getItem('clubChatMessages') || '[]');
    // -1 to exclude the typing indicator element
    var shownCount = messagesArea.children.length - 1;

    if (savedMsgs.length > shownCount) {
        var newOnes = savedMsgs.slice(shownCount);
        newOnes.forEach(function (m) {
            if (m.status === 'team-answered') {
                showMessage(m.text, m.sender, m.timestamp, true);
            }
        });
    }
}

// ---- HELPERS ----
function formatChatTime(ts) {
    var d = new Date(ts);
    var hrs  = d.getHours();
    var mins = d.getMinutes();
    var ampm = hrs >= 12 ? 'PM' : 'AM';
    var h12  = hrs % 12 || 12;
    var mm   = mins < 10 ? '0' + mins : mins;
    return h12 + ':' + mm + ' ' + ampm;
}

function scrollDown() {
    setTimeout(function () {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }, 100);
}

console.log('student-chatbot.js loaded ✅');
(function() {
    const saved = localStorage.getItem('clustrcore-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
})();

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('clustrcore-theme', next);
});