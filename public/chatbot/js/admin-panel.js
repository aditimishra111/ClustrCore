
/* ========================================
   ADMIN PANEL LOGIC
   ======================================== */

var pendingContainer;
var answeredContainer;
var pendingCountEl;
var answeredCountEl;
var currentTab = 'pending';
var refreshTimer = null;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', function () {
    pendingContainer  = document.getElementById('pendingContainer');
    answeredContainer = document.getElementById('answeredContainer');
    pendingCountEl    = document.getElementById('pendingCount');
    answeredCountEl   = document.getElementById('answeredCount');

    var pendingTabBtn  = document.getElementById('pendingTab');
    var answeredTabBtn = document.getElementById('answeredTab');

    pendingTabBtn.addEventListener('click',  function () { switchTab('pending'); });
    answeredTabBtn.addEventListener('click', function () { switchTab('answered'); });

    loadAllQuestions();
    startAutoRefresh();

    // Pause refresh while admin is typing in a reply box
    document.addEventListener('focusin', function (evt) {
        if (evt.target.classList.contains('reply-textarea')) {
            stopAutoRefresh();
        }
    });
    document.addEventListener('focusout', function (evt) {
        if (evt.target.classList.contains('reply-textarea')) {
            startAutoRefresh();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (evt) {
        if ((evt.ctrlKey || evt.metaKey) && evt.key === '1') { evt.preventDefault(); switchTab('pending'); }
        if ((evt.ctrlKey || evt.metaKey) && evt.key === '2') { evt.preventDefault(); switchTab('answered'); }
    });

    console.log('Admin panel ready ✅');
});

function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(loadAllQuestions, 5000);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

// ---- TAB SWITCH ----
function switchTab(tabName) {
    currentTab = tabName;
    var pendingTabBtn  = document.getElementById('pendingTab');
    var answeredTabBtn = document.getElementById('answeredTab');

    if (tabName === 'pending') {
        pendingTabBtn.classList.add('active');
        answeredTabBtn.classList.remove('active');
        pendingContainer.classList.remove('hidden');
        answeredContainer.classList.add('hidden');
    } else {
        answeredTabBtn.classList.add('active');
        pendingTabBtn.classList.remove('active');
        answeredContainer.classList.remove('hidden');
        pendingContainer.classList.add('hidden');
    }
}

// ---- LOAD ALL QUESTIONS ----
function loadAllQuestions() {
    var pendingData  = getPendingQuestions();
    var answeredData = getAnsweredQuestions();

    // Update the stat cards on top
    if (pendingCountEl)  pendingCountEl.textContent  = pendingData.length;
    if (answeredCountEl) answeredCountEl.textContent = answeredData.length;

    // Update the counts inside the tab buttons
    var pendingTabCount  = document.getElementById('pendingTabCount');
    var answeredTabCount = document.getElementById('answeredTabCount');
    if (pendingTabCount)  pendingTabCount.textContent  = pendingData.length;
    if (answeredTabCount) answeredTabCount.textContent = answeredData.length;

    renderPendingQuestions(pendingData);
    renderAnsweredQuestions(answeredData);
}

// ---- RENDER PENDING ----
function renderPendingQuestions(questionList) {
    // Save any draft text before wiping
    var drafts = {};
    var existingAreas = pendingContainer.querySelectorAll('textarea[id^="reply-"]');
    existingAreas.forEach(function (ta) {
        var qId = ta.id.replace('reply-', '');
        if (ta.value.trim() !== '') {
            drafts[qId] = ta.value;
        }
    });

    pendingContainer.innerHTML = '';

    if (questionList.length === 0) {
        pendingContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⏰</div><h3>No pending questions</h3><p>All caught up! Great job!</p></div>';
        return;
    }

    questionList.forEach(function (qItem) {
        var card = buildPendingCard(qItem);
        pendingContainer.appendChild(card);
    });

    // Restore drafts
    Object.keys(drafts).forEach(function (qId) {
        var ta = document.getElementById('reply-' + qId);
        if (ta) ta.value = drafts[qId];
    });
}

// ---- BUILD PENDING CARD ----
function buildPendingCard(qItem) {
    var card = document.createElement('div');
    card.className = 'question-card';

    var isBlocked = isStudentBlocked(qItem.studentId);
    var blockBtnLabel = isBlocked ? '✅ Unblock Student' : '🚫 Block Student';
    var blockBtnClass = isBlocked ? 'btn btn-unblock' : 'btn btn-block';

    card.innerHTML = [
        '<div class="question-header">',
            '<div class="question-info">',
                '<div class="student-avatar">S</div>',
                '<div class="question-meta">',
                    '<h3>Student Question</h3>',
                    '<p class="question-timestamp">' + formatDateTime(qItem.timestamp) + ' • ' + timeAgo(qItem.timestamp) + '</p>',
                    '<p class="student-id-label">ID: ' + safeText(qItem.studentId) + '</p>',
                '</div>',
            '</div>',
            '<span class="status-badge pending">NEEDS REPLY</span>',
        '</div>',
        '<div class="question-text-box">',
            '<div class="question-label">Question:</div>',
            '<div class="question-text">' + safeText(qItem.question) + '</div>',
        '</div>',
        '<div class="reply-section">',
            '<textarea class="reply-textarea" id="reply-' + qItem.id + '" placeholder="Type your reply here..."></textarea>',
            '<div class="reply-actions">',
                '<button class="btn btn-primary" onclick="handleReply(' + qItem.id + ')">Send Reply</button>',
                '<button class="btn btn-danger"  onclick="handleDelete(' + qItem.id + ', false)">Delete</button>',
                '<button class="' + blockBtnClass + '" onclick="handleBlockToggle(\'' + qItem.studentId + '\')">' + blockBtnLabel + '</button>',
            '</div>',
        '</div>'
    ].join('');

    return card;
}

// ---- RENDER ANSWERED ----
function renderAnsweredQuestions(questionList) {
    answeredContainer.innerHTML = '';

    if (questionList.length === 0) {
        answeredContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div><h3>No answered questions yet</h3><p>Answered questions will appear here</p></div>';
        return;
    }

    questionList.forEach(function (qItem) {
        var card = buildAnsweredCard(qItem);
        answeredContainer.appendChild(card);
    });
}

// ---- BUILD ANSWERED CARD ----
function buildAnsweredCard(qItem) {
    var card = document.createElement('div');
    card.className = 'question-card';

    card.innerHTML = [
        '<div class="question-header">',
            '<div class="question-info">',
                '<div class="student-avatar answered">✓</div>',
                '<div class="question-meta">',
                    '<h3>Answered by ' + safeText(qItem.answeredBy) + '</h3>',
                    '<p class="question-timestamp">Answered on ' + formatDateTime(qItem.answeredAt) + '</p>',
                '</div>',
            '</div>',
            '<button class="btn btn-danger" onclick="handleDelete(' + qItem.id + ', true)">Delete</button>',
        '</div>',
        '<div class="question-text-box">',
            '<div class="question-label">Question:</div>',
            '<div class="question-text">' + safeText(qItem.question) + '</div>',
        '</div>',
        '<div class="answer-box">',
            '<div class="question-label answered-label">Your Reply:</div>',
            '<div class="answer-text">' + safeText(qItem.reply) + '</div>',
        '</div>'
    ].join('');

    return card;
}

// ---- HANDLE REPLY ----
function handleReply(questionId) {
    var replyBox = document.getElementById('reply-' + questionId);
    var replyText = replyBox.value.trim();

    if (replyText === '') {
        showNotification('Please write a reply first', 'error');
        replyBox.focus();
        return;
    }

    var ok = markQuestionAsAnswered(questionId, replyText);

    if (ok) {
        showNotification('Reply sent successfully ✅', 'success');
        loadAllQuestions();
    } else {
        showNotification('Error sending reply. Please try again.', 'error');
    }
}

// ---- HANDLE DELETE ----
function handleDelete(questionId, fromAnswered) {
    var msg = fromAnswered
        ? 'Delete this answered question from history?'
        : 'Delete this pending question? The student will not receive a reply.';

    showConfirmDialog(msg, function () {
        var ok = deleteQuestion(questionId, fromAnswered);
        if (ok) {
            showNotification('Question deleted ✅', 'success');
            loadAllQuestions();
        } else {
            showNotification('Error deleting question.', 'error');
        }
    });
}

// ---- HANDLE BLOCK / UNBLOCK ----
function handleBlockToggle(studentId) {
    if (isStudentBlocked(studentId)) {
        showConfirmDialog('Unblock this student? They will be able to send messages again.', function () {
            unblockStudent(studentId);
            showNotification('Student unblocked ✅', 'success');
            loadAllQuestions();
        });
    } else {
        showConfirmDialog('Block this student? They will see a blocked message on their chatbot.', function () {
            blockStudent(studentId);
            showNotification('Student blocked 🚫', 'success');
            loadAllQuestions();
        });
    }
}

// ---- NOTIFICATION ----
function showNotification(msg, type) {
    var existing = document.querySelector('.notification');
    if (existing) existing.remove();

    var note = document.createElement('div');
    note.className = 'notification notification-' + (type || 'info');
    note.textContent = msg;
    document.body.appendChild(note);

    setTimeout(function () { note.classList.add('show'); }, 10);
    setTimeout(function () {
        note.classList.remove('show');
        setTimeout(function () { note.remove(); }, 300);
    }, 3000);
}

// ---- CONFIRM DIALOG ----
function showConfirmDialog(message, onConfirm) {
    var existing = document.querySelector('.confirm-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = [
        '<div class="confirm-content">',
            '<h3>Confirm Action</h3>',
            '<p>' + message + '</p>',
            '<div class="confirm-actions">',
                '<button class="btn btn-danger"   id="cancelConfirmBtn">Cancel</button>',
                '<button class="btn btn-primary"  id="okConfirmBtn">Confirm</button>',
            '</div>',
        '</div>'
    ].join('');

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('show'); }, 10);

    function closeDialog() {
        overlay.classList.remove('show');
        setTimeout(function () { overlay.remove(); }, 300);
    }

    document.getElementById('okConfirmBtn').addEventListener('click', function () {
        closeDialog();
        onConfirm();
    });
    document.getElementById('cancelConfirmBtn').addEventListener('click', closeDialog);
    overlay.addEventListener('click', function (evt) {
        if (evt.target === overlay) closeDialog();
    });
}

// ---- HELPERS ----
function safeText(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function formatDateTime(ts) {
    var d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts) {
    var diffMs   = Date.now() - new Date(ts).getTime();
    var diffMins  = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins < 1)  return 'Just now';
    if (diffMins < 60) return diffMins + ' min ago';
    if (diffHours < 24) return diffHours + ' hour' + (diffHours > 1 ? 's' : '') + ' ago';
    return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
}

console.log('admin-panel.js loaded ✅');
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
