
/* ========================================
   FAQ DATA + SHARED UTILITY FUNCTIONS
   ======================================== */

const faqs = [
    {
        id: 1,
        keywords: ['join', 'membership', 'become member', 'sign up', 'register', 'how to join'],
        answer: "To join our club, simply fill out the membership form on our website at clubwebsite.com/join. Membership is open to all students and costs ₹500 per semester. You'll get access to all events, workshops, and exclusive resources!"
    },
    {
        id: 2,
        keywords: ['next event', 'upcoming event', 'when is event', 'event date', 'events'],
        answer: "Our next event is the 'Tech Innovation Summit' on March 15th, 2026 at 3:00 PM in the Main Auditorium. Registration is free for members! Check our Events page for more details."
    },
    {
        id: 3,
        keywords: ['meeting', 'when meet', 'club meeting', 'meet time', 'where meet'],
        answer: "We have club meetings every Friday at 5:00 PM in Room 204. All members are welcome to attend. We discuss upcoming events, plan activities, and share ideas!"
    },
    {
        id: 4,
        keywords: ['contact', 'email', 'phone', 'reach', 'get in touch', 'call'],
        answer: "You can reach us at:\n📧 Email: clubevents@college.edu\n📱 Phone: +91-9876543210\n💬 Instagram: @ourclubofficial"
    },
    {
        id: 5,
        keywords: ['fee', 'cost', 'price', 'payment', 'how much', 'charges'],
        answer: "Membership fee is ₹500 per semester. Most events are free for members, though some special workshops may have a small fee (₹100-200). We accept UPI, cash, and online payments."
    },
    {
        id: 6,
        keywords: ['benefit', 'advantage', 'why join', 'perks', 'what do i get'],
        answer: "Club members get:\n✨ Free access to all events & workshops\n🎓 Skill development sessions\n🤝 Networking opportunities\n📜 Certificates for participation\n🎁 Exclusive resources and materials"
    },
    {
        id: 7,
        keywords: ['location', 'where', 'address', 'campus'],
        answer: "Our club office is located in the Student Activity Center, Room 204, 2nd Floor. We're open Monday to Friday, 2:00 PM - 6:00 PM."
    },
    {
        id: 8,
        keywords: ['president', 'head', 'leader', 'who runs', 'team'],
        answer: "Our current club president is Rahul Sharma. The core team includes Vice President Priya Gupta, Event Head Arjun Patel, and Technical Head Sneha Reddy. You can meet them at our weekly meetings!"
    }
];

// ---- FAQ CHECKER ----
function checkFAQ(userQuestion) {
    const lowerQ = userQuestion.toLowerCase();

    for (let i = 0; i < faqs.length; i++) {
        const entry = faqs[i];
        for (let j = 0; j < entry.keywords.length; j++) {
            if (lowerQ.includes(entry.keywords[j].toLowerCase())) {
                return { matched: true, answer: entry.answer, faqId: entry.id };
            }
        }
    }

    return { matched: false, answer: null };
}

// ---- SAVE PENDING QUESTION ----
// studentId is passed in so the admin can identify & block the right student
function savePendingQuestion(questionText, studentId) {
    const allPending = JSON.parse(localStorage.getItem('pendingQuestions') || '[]');

    const newEntry = {
        id: Date.now(),
        question: questionText,
        timestamp: new Date().toISOString(),
        status: 'pending',
        studentId: studentId || 'unknown'
    };

    allPending.push(newEntry);
    localStorage.setItem('pendingQuestions', JSON.stringify(allPending));
    console.log('Question saved for team:', newEntry);
}

// ---- GET QUESTIONS ----
function getPendingQuestions() {
    return JSON.parse(localStorage.getItem('pendingQuestions') || '[]');
}

function getAnsweredQuestions() {
    return JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
}

// ---- MARK AS ANSWERED ----
function markQuestionAsAnswered(questionId, replyText) {
    const pendingList = getPendingQuestions();
    const idx = pendingList.findIndex(function(q) { return q.id === questionId; });

    if (idx === -1) {
        console.error('Question not found:', questionId);
        return false;
    }

    const targetQuestion = pendingList[idx];

    const answeredEntry = {
        id: targetQuestion.id,
        question: targetQuestion.question,
        studentId: targetQuestion.studentId,
        timestamp: targetQuestion.timestamp,
        reply: replyText,
        status: 'answered',
        answeredAt: new Date().toISOString(),
        answeredBy: 'Team Member'
    };

    // Remove from pending
    pendingList.splice(idx, 1);
    localStorage.setItem('pendingQuestions', JSON.stringify(pendingList));

    // Add to answered
    const answeredList = getAnsweredQuestions();
    answeredList.push(answeredEntry);
    localStorage.setItem('answeredQuestions', JSON.stringify(answeredList));

    // Push reply into student chat
    pushReplyToStudentChat(replyText);

    return true;
}

// ---- PUSH REPLY TO STUDENT CHAT ----
function pushReplyToStudentChat(replyText) {
    const chatHistory = JSON.parse(localStorage.getItem('clubChatMessages') || '[]');

    chatHistory.push({
        id: Date.now(),
        text: '📬 Team Reply:\n' + replyText,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        status: 'team-answered'
    });

    localStorage.setItem('clubChatMessages', JSON.stringify(chatHistory));
}

// ---- DELETE QUESTION ----
function deleteQuestion(questionId, fromAnswered) {
    var storageKey = fromAnswered ? 'answeredQuestions' : 'pendingQuestions';
    var existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    var filtered = existing.filter(function(q) { return q.id !== questionId; });
    localStorage.setItem(storageKey, JSON.stringify(filtered));
    return true;
}

// ---- BLOCK SYSTEM ----
function blockStudent(studentId) {
    var blockedList = JSON.parse(localStorage.getItem('blockedStudents') || '[]');
    if (!blockedList.includes(studentId)) {
        blockedList.push(studentId);
        localStorage.setItem('blockedStudents', JSON.stringify(blockedList));
    }
}

function unblockStudent(studentId) {
    var blockedList = JSON.parse(localStorage.getItem('blockedStudents') || '[]');
    var updated = blockedList.filter(function(id) { return id !== studentId; });
    localStorage.setItem('blockedStudents', JSON.stringify(updated));
}

function isStudentBlocked(studentId) {
    var blockedList = JSON.parse(localStorage.getItem('blockedStudents') || '[]');
    return blockedList.includes(studentId);
}

console.log('faq-data.js loaded ✅');