/* ===================================
   SECRET SANTA - APPLICATION LOGIC
   =================================== */

// =====================================
// STATE MANAGEMENT
// =====================================

const state = {
    currentStep: 1,
    event: {
        name: '',
        date: '',
        budget: 0,
        message: ''
    },
    participants: [],
    exclusions: [],
    assignments: {},
    generated: false,
    revealedParticipants: [],
    eventId: null,
    revealOnlyMode: false  // When true, show only reveal page (for employees)
};

// =====================================
// DOM ELEMENTS
// =====================================

const elements = {
    // Snowfall
    snowfall: document.getElementById('snowfall'),
    confetti: document.getElementById('confetti'),

    // Progress
    progressFill: document.getElementById('progressFill'),
    stepBtns: document.querySelectorAll('.step-btn'),
    stepPanels: document.querySelectorAll('.step-panel'),

    // Event Setup
    eventName: document.getElementById('eventName'),
    eventDate: document.getElementById('eventDate'),
    budget: document.getElementById('budget'),
    eventMessage: document.getElementById('eventMessage'),

    // Participants
    participantName: document.getElementById('participantName'),
    participantEmail: document.getElementById('participantEmail'),
    participantWishlist: document.getElementById('participantWishlist'),
    addParticipantBtn: document.getElementById('addParticipantBtn'),
    participantsList: document.getElementById('participantsList'),
    emptyParticipants: document.getElementById('emptyParticipants'),
    participantCount: document.getElementById('participantCount'),

    // Exclusions
    exclusionPerson1: document.getElementById('exclusionPerson1'),
    exclusionPerson2: document.getElementById('exclusionPerson2'),
    addExclusionBtn: document.getElementById('addExclusionBtn'),
    exclusionsList: document.getElementById('exclusionsList'),
    emptyExclusions: document.getElementById('emptyExclusions'),

    // Generate
    summaryParticipants: document.getElementById('summaryParticipants'),
    summaryExclusions: document.getElementById('summaryExclusions'),
    summaryBudget: document.getElementById('summaryBudget'),
    generateBtn: document.getElementById('generateBtn'),
    generateAnimation: document.getElementById('generateAnimation'),

    // Reveal - Email-based Firebase System
    revealEventName: document.getElementById('revealEventName'),
    revealEventDate: document.getElementById('revealEventDate'),
    revealEventMessage: document.getElementById('revealEventMessage'),
    eventBanner: document.getElementById('eventBanner'),
    emailRevealSection: document.getElementById('emailRevealSection'),
    revealEmail: document.getElementById('revealEmail'),
    revealEmailBtn: document.getElementById('revealEmailBtn'),
    loadingSection: document.getElementById('loadingSection'),
    notFoundSection: document.getElementById('notFoundSection'),
    notFoundDetails: document.getElementById('notFoundDetails'),
    tryAgainBtn: document.getElementById('tryAgainBtn'),
    singleRevealContainer: document.getElementById('singleRevealContainer'),
    verifiedName: document.getElementById('verifiedName'),
    revealCardLarge: document.getElementById('revealCardLarge'),
    revealForName: document.getElementById('revealForName'),
    revealMatchName: document.getElementById('revealMatchName'),
    revealMatchWishlist: document.getElementById('revealMatchWishlist'),
    revealMatchBudget: document.getElementById('revealMatchBudget'),
    alreadyRevealed: document.getElementById('alreadyRevealed'),
    resetBtn: document.getElementById('resetBtn'),
    exportBtn: document.getElementById('exportBtn'),

    // Shareable Link
    shareableLinkSection: document.getElementById('shareableLinkSection'),
    shareableLink: document.getElementById('shareableLink'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Modal
    exportModal: document.getElementById('exportModal'),
    closeExportModal: document.getElementById('closeExportModal'),
    exportJSON: document.getElementById('exportJSON'),
    copyAssignments: document.getElementById('copyAssignments'),
    printCards: document.getElementById('printCards'),
    importFile: document.getElementById('importFile')
};

// =====================================
// INITIALIZATION
// =====================================

function init() {
    // Check if this is a reveal-only link for employees
    if (checkRevealOnlyMode()) {
        return; // Handled by reveal mode
    }

    loadFromStorage();
    createSnowfall();
    bindEvents();
    updateUI();
    setDefaultDate();
}

function checkRevealOnlyMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const revealEventId = urlParams.get('reveal');

    if (revealEventId) {
        // This is a reveal-only link for employees
        state.revealOnlyMode = true;
        state.eventId = revealEventId;

        // Load event data from storage
        loadFromStorage();

        // Hide admin UI, show only reveal
        setupRevealOnlyMode();

        createSnowfall();
        bindEvents();
        return true;
    }
    return false;
}

function setupRevealOnlyMode() {
    // Hide progress nav and header subtitle
    document.querySelector('.progress-nav').style.display = 'none';
    document.querySelector('.tagline').style.display = 'none';

    // Hide all panels except reveal
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });

    // Show only reveal panel
    const revealPanel = document.getElementById('step5');
    revealPanel.style.display = 'block';
    revealPanel.classList.add('active');

    // Update reveal section
    updateRevealSection();
}

function setDefaultDate() {
    if (!state.event.date) {
        const today = new Date();
        const christmas = new Date(today.getFullYear(), 11, 25);
        if (today > christmas) {
            christmas.setFullYear(christmas.getFullYear() + 1);
        }
        elements.eventDate.valueAsDate = christmas;
    }
}

// =====================================
// FIREBASE CONFIGURATION
// =====================================

// IMPORTANT: Replace with your Firebase project config
// Get from: https://console.firebase.google.com > Project Settings
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let db = null;
let firebaseInitialized = false;

function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.log('Firebase not loaded yet, will retry...');
        setTimeout(initFirebase, 500);
        return;
    }

    try {
        // Check if already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        firebaseInitialized = true;
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

// Publish assignments to Firestore (called after generation)
async function publishAssignmentsToFirebase() {
    if (!db) {
        showToast('Firebase not initialized. Check your config.', 'error');
        return false;
    }

    const eventId = generateEventId();
    state.eventId = eventId;

    try {
        // Create event document
        await db.collection('events').doc(eventId).set({
            name: state.event.name,
            date: state.event.date,
            budget: state.event.budget,
            message: state.event.message,
            createdAt: new Date().toISOString()
        });

        // Create individual assignment documents (only accessible by email lookup)
        const batch = db.batch();

        for (const participant of state.participants) {
            const matchId = state.assignments[participant.id];
            const match = state.participants.find(p => p.id === matchId);

            if (participant.email && match) {
                const assignmentRef = db.collection('events').doc(eventId)
                    .collection('assignments').doc(participant.email.toLowerCase());

                batch.set(assignmentRef, {
                    participantName: participant.name,
                    matchName: match.name,
                    matchWishlist: match.wishlist || '',
                    budget: state.event.budget,
                    revealed: false
                });
            }
        }

        await batch.commit();
        saveToStorage();

        return eventId;
    } catch (error) {
        console.error('Error publishing to Firebase:', error);
        showToast('Error publishing assignments. Check Firebase config.', 'error');
        return false;
    }
}

function generateEventId() {
    return 'ss_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// Look up assignment by email
async function lookupAssignmentByEmail(email, eventId) {
    if (!db) {
        throw new Error('Firebase not initialized');
    }

    const emailLower = email.toLowerCase().trim();
    const assignmentDoc = await db.collection('events').doc(eventId)
        .collection('assignments').doc(emailLower).get();

    if (!assignmentDoc.exists) {
        return null;
    }

    return assignmentDoc.data();
}

// =====================================
// SNOWFALL EFFECT
// =====================================

function createSnowfall() {
    const snowflakes = ['❄', '❅', '❆', '✧', '✦'];
    const count = 50;

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            createSnowflake(snowflakes);
        }, i * 200);
    }

    // Continue creating snowflakes
    setInterval(() => {
        createSnowflake(snowflakes);
    }, 500);
}

function createSnowflake(snowflakes) {
    const snowflake = document.createElement('div');
    snowflake.className = 'snowflake';
    snowflake.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
    snowflake.style.left = Math.random() * 100 + '%';
    snowflake.style.animationDuration = (Math.random() * 5 + 5) + 's';
    snowflake.style.opacity = Math.random() * 0.5 + 0.3;
    snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';

    elements.snowfall.appendChild(snowflake);

    // Remove snowflake after animation
    setTimeout(() => {
        snowflake.remove();
    }, 10000);
}

// =====================================
// CONFETTI EFFECT
// =====================================

function triggerConfetti() {
    const colors = ['#c41e3a', '#1a472a', '#ffd700', '#ffffff', '#ff6b6b'];
    const count = 100;

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

            if (Math.random() > 0.5) {
                confetti.style.borderRadius = '50%';
            }

            elements.confetti.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, 4000);
        }, i * 20);
    }
}

// =====================================
// EVENT BINDINGS
// =====================================

function bindEvents() {
    // Navigation buttons
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = parseInt(btn.dataset.next);
            goToStep(nextStep);
        });
    });

    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = parseInt(btn.dataset.prev);
            goToStep(prevStep);
        });
    });

    // Step buttons
    elements.stepBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.step);
            if (canGoToStep(step)) {
                goToStep(step);
            }
        });
    });

    // Event setup inputs
    elements.eventName.addEventListener('input', (e) => {
        state.event.name = e.target.value;
        saveToStorage();
    });

    elements.eventDate.addEventListener('change', (e) => {
        state.event.date = e.target.value;
        saveToStorage();
    });

    elements.budget.addEventListener('input', (e) => {
        state.event.budget = parseFloat(e.target.value) || 0;
        saveToStorage();
    });

    elements.eventMessage.addEventListener('input', (e) => {
        state.event.message = e.target.value;
        saveToStorage();
    });

    // Participant management
    elements.addParticipantBtn.addEventListener('click', addParticipant);
    elements.participantName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addParticipant();
    });

    // Exclusion management
    elements.addExclusionBtn.addEventListener('click', addExclusion);

    // Generate
    elements.generateBtn.addEventListener('click', generateAssignments);

    // Reset
    elements.resetBtn.addEventListener('click', resetAll);

    // Email-based Firebase Reveal System
    elements.revealEmailBtn.addEventListener('click', handleEmailReveal);
    elements.revealEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleEmailReveal();
    });
    elements.tryAgainBtn.addEventListener('click', resetRevealView);

    // Shareable Link
    if (elements.copyLinkBtn) {
        elements.copyLinkBtn.addEventListener('click', copyShareableLink);
    }

    // Export
    elements.exportBtn.addEventListener('click', () => {
        elements.exportModal.classList.add('active');
    });

    elements.closeExportModal.addEventListener('click', () => {
        elements.exportModal.classList.remove('active');
    });

    elements.exportModal.addEventListener('click', (e) => {
        if (e.target === elements.exportModal) {
            elements.exportModal.classList.remove('active');
        }
    });

    elements.exportJSON.addEventListener('click', exportToJSON);
    elements.copyAssignments.addEventListener('click', copyAssignmentsToClipboard);
    elements.printCards.addEventListener('click', () => window.print());
    elements.importFile.addEventListener('change', importFromJSON);
}

// =====================================
// NAVIGATION
// =====================================

function canGoToStep(step) {
    if (step <= state.currentStep) return true;
    if (step === 2) return true;
    if (step === 3) return state.participants.length >= 3;
    if (step === 4) return state.participants.length >= 3;
    if (step === 5) return state.generated;
    return false;
}

function goToStep(step) {
    if (step < 1 || step > 5) return;

    // Save current form data
    saveEventData();

    // Update state
    state.currentStep = step;

    // Update progress bar
    const progress = ((step - 1) / 4) * 100;
    elements.progressFill.style.width = progress + '%';

    // Update step buttons
    elements.stepBtns.forEach(btn => {
        const btnStep = parseInt(btn.dataset.step);
        btn.classList.remove('active', 'completed');
        if (btnStep === step) {
            btn.classList.add('active');
        } else if (btnStep < step) {
            btn.classList.add('completed');
        }
    });

    // Update panels
    elements.stepPanels.forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');

    // Step-specific updates
    if (step === 3) {
        updateExclusionDropdowns();
    } else if (step === 4) {
        updateGenerateSummary();
    } else if (step === 5) {
        updateRevealSection();
    }

    saveToStorage();
}

// =====================================
// PARTICIPANT MANAGEMENT
// =====================================

function addParticipant() {
    const name = elements.participantName.value.trim();
    const email = elements.participantEmail.value.trim();
    const wishlist = elements.participantWishlist.value.trim();

    if (!name) {
        showToast('Please enter a name', 'error');
        elements.participantName.focus();
        return;
    }

    // Check for duplicate names
    if (state.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('This person is already added', 'error');
        return;
    }

    const participant = {
        id: generateId(),
        name,
        email,
        wishlist
    };

    state.participants.push(participant);

    // Clear form
    elements.participantName.value = '';
    elements.participantEmail.value = '';
    elements.participantWishlist.value = '';
    elements.participantName.focus();

    renderParticipants();
    saveToStorage();
    showToast(`${name} added!`, 'success');
}

function removeParticipant(id) {
    const participant = state.participants.find(p => p.id === id);
    state.participants = state.participants.filter(p => p.id !== id);

    // Remove any exclusions involving this participant
    state.exclusions = state.exclusions.filter(e =>
        e.person1 !== id && e.person2 !== id
    );

    renderParticipants();
    renderExclusions();
    saveToStorage();
    showToast(`${participant.name} removed`, 'warning');
}

function renderParticipants() {
    if (state.participants.length === 0) {
        elements.emptyParticipants.style.display = 'block';
        elements.participantCount.textContent = '0';

        // Remove all participant items
        const items = elements.participantsList.querySelectorAll('.participant-item');
        items.forEach(item => item.remove());
        return;
    }

    elements.emptyParticipants.style.display = 'none';
    elements.participantCount.textContent = state.participants.length;

    // Remove existing items
    const items = elements.participantsList.querySelectorAll('.participant-item');
    items.forEach(item => item.remove());

    // Render participants
    state.participants.forEach(participant => {
        const initials = participant.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        const item = document.createElement('div');
        item.className = 'participant-item';
        item.innerHTML = `
            <div class="participant-avatar">${initials}</div>
            <div class="participant-info">
                <div class="participant-name">${escapeHtml(participant.name)}</div>
                ${participant.email ? `<div class="participant-email">${escapeHtml(participant.email)}</div>` : ''}
                ${participant.wishlist ? `<div class="participant-wishlist">🎁 ${escapeHtml(participant.wishlist)}</div>` : ''}
            </div>
            <div class="participant-actions">
                <button class="btn-icon-only btn-delete" onclick="removeParticipant('${participant.id}')" title="Remove">🗑️</button>
            </div>
        `;

        elements.participantsList.appendChild(item);
    });
}

// =====================================
// EXCLUSION MANAGEMENT
// =====================================

function updateExclusionDropdowns() {
    const options = state.participants.map(p =>
        `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');

    elements.exclusionPerson1.innerHTML = `<option value="">Select person...</option>${options}`;
    elements.exclusionPerson2.innerHTML = `<option value="">Select person...</option>${options}`;

    renderExclusions();
}

function addExclusion() {
    const person1 = elements.exclusionPerson1.value;
    const person2 = elements.exclusionPerson2.value;

    if (!person1 || !person2) {
        showToast('Please select two people', 'error');
        return;
    }

    if (person1 === person2) {
        showToast('Cannot exclude someone from themselves', 'error');
        return;
    }

    // Check if exclusion already exists
    const exists = state.exclusions.some(e =>
        (e.person1 === person1 && e.person2 === person2) ||
        (e.person1 === person2 && e.person2 === person1)
    );

    if (exists) {
        showToast('This exclusion already exists', 'error');
        return;
    }

    const exclusion = {
        id: generateId(),
        person1,
        person2
    };

    state.exclusions.push(exclusion);

    // Reset dropdowns
    elements.exclusionPerson1.value = '';
    elements.exclusionPerson2.value = '';

    renderExclusions();
    saveToStorage();

    const p1 = state.participants.find(p => p.id === person1);
    const p2 = state.participants.find(p => p.id === person2);
    showToast(`${p1.name} ↔ ${p2.name} won't be matched`, 'success');
}

function removeExclusion(id) {
    state.exclusions = state.exclusions.filter(e => e.id !== id);
    renderExclusions();
    saveToStorage();
    showToast('Exclusion removed', 'warning');
}

function renderExclusions() {
    if (state.exclusions.length === 0) {
        elements.emptyExclusions.style.display = 'block';

        const items = elements.exclusionsList.querySelectorAll('.exclusion-item');
        items.forEach(item => item.remove());
        return;
    }

    elements.emptyExclusions.style.display = 'none';

    // Remove existing items
    const items = elements.exclusionsList.querySelectorAll('.exclusion-item');
    items.forEach(item => item.remove());

    // Render exclusions
    state.exclusions.forEach(exclusion => {
        const p1 = state.participants.find(p => p.id === exclusion.person1);
        const p2 = state.participants.find(p => p.id === exclusion.person2);

        if (!p1 || !p2) return;

        const item = document.createElement('div');
        item.className = 'exclusion-item';
        item.innerHTML = `
            <div class="exclusion-pair">
                <span class="exclusion-person">${escapeHtml(p1.name)}</span>
                <span class="exclusion-icon">🚫</span>
                <span class="exclusion-person">${escapeHtml(p2.name)}</span>
            </div>
            <button class="btn-icon-only btn-delete" onclick="removeExclusion('${exclusion.id}')" title="Remove">🗑️</button>
        `;

        elements.exclusionsList.appendChild(item);
    });
}

// =====================================
// GENERATE ASSIGNMENTS
// =====================================

function updateGenerateSummary() {
    elements.summaryParticipants.textContent = state.participants.length;
    elements.summaryExclusions.textContent = state.exclusions.length;
    elements.summaryBudget.textContent = state.event.budget ? `$${state.event.budget}` : 'None';
}

function generateAssignments() {
    if (state.participants.length < 3) {
        showToast('Need at least 3 participants', 'error');
        return;
    }

    // Animate the button
    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = '<span class="btn-sparkle">✨</span> Generating... <span class="btn-sparkle">✨</span>';

    // Animate gift box
    const giftBox = elements.generateAnimation.querySelector('.gift-box');
    giftBox.style.animation = 'shake 0.1s ease infinite';

    // Simulate processing time for effect
    setTimeout(() => {
        const result = runAssignmentAlgorithm();

        giftBox.style.animation = '';

        if (result.success) {
            state.assignments = result.assignments;
            state.generated = true;

            // Generate event ID for shareable link
            if (!state.eventId) {
                state.eventId = generateEventId();
            }
            saveToStorage();

            // Show shareable link
            showShareableLink();

            triggerConfetti();
            showToast('🎉 Assignments generated successfully!', 'success');

            // Don't auto-navigate - let HR copy the link first
        } else {
            showToast(result.error, 'error');
        }

        elements.generateBtn.disabled = false;
        elements.generateBtn.innerHTML = '<span class="btn-sparkle">✨</span> Generate Assignments <span class="btn-sparkle">✨</span>';
    }, 1500);
}

function showShareableLink() {
    const baseUrl = window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?reveal=${state.eventId}`;

    elements.shareableLink.value = shareUrl;
    elements.shareableLinkSection.style.display = 'block';
}

function copyShareableLink() {
    elements.shareableLink.select();
    document.execCommand('copy');

    // Also try modern clipboard API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(elements.shareableLink.value);
    }

    showToast('📋 Link copied to clipboard!', 'success');

    // Visual feedback
    elements.copyLinkBtn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
    setTimeout(() => {
        elements.copyLinkBtn.innerHTML = '<span class="btn-icon">📋</span> Copy Link';
    }, 2000);
}

function runAssignmentAlgorithm() {
    const maxAttempts = 1000;
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;
        const result = tryAssignment();
        if (result.success) {
            return result;
        }
    }

    return {
        success: false,
        error: 'Could not generate valid assignments. Try reducing exclusions.'
    };
}

function tryAssignment() {
    const givers = [...state.participants];
    const receivers = [...state.participants];

    // Fisher-Yates shuffle
    for (let i = receivers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }

    const assignments = {};

    for (let i = 0; i < givers.length; i++) {
        const giver = givers[i];
        const receiver = receivers[i];

        // Check if assigning to self
        if (giver.id === receiver.id) {
            return { success: false };
        }

        // Check exclusions
        const excluded = state.exclusions.some(e =>
            (e.person1 === giver.id && e.person2 === receiver.id) ||
            (e.person1 === receiver.id && e.person2 === giver.id)
        );

        if (excluded) {
            return { success: false };
        }

        assignments[giver.id] = receiver.id;
    }

    return { success: true, assignments };
}

// =====================================
// GOOGLE SIGN-IN REVEAL SECTION
// =====================================

function updateRevealSection() {
    // Update event info
    elements.revealEventName.textContent = state.event.name || 'Secret Santa 2024';

    if (state.event.date) {
        const date = new Date(state.event.date);
        elements.revealEventDate.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    if (state.event.message) {
        elements.revealEventMessage.textContent = state.event.message;
        elements.revealEventMessage.style.display = 'block';
    } else {
        elements.revealEventMessage.style.display = 'none';
    }

    // Initialize Firebase
    initFirebase();

    // Reset to initial state
    resetRevealView();
}

// Handle email-based reveal lookup
async function handleEmailReveal() {
    const email = elements.revealEmail.value.trim();

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    // Validate email format
    if (!email.includes('@')) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    // Get event ID from URL or state
    const eventId = getEventIdFromUrl() || state.eventId;

    if (!eventId) {
        // Fall back to local lookup if no Firebase event
        handleLocalEmailReveal(email);
        return;
    }

    // Show loading
    showLoading();

    try {
        const assignment = await lookupAssignmentByEmail(email, eventId);

        if (!assignment) {
            showNotFound(email);
            return;
        }

        // Show the reveal card with fetched data
        showRevealCardFromFirebase(assignment, email);

    } catch (error) {
        console.error('Error looking up assignment:', error);
        // Fall back to local lookup
        handleLocalEmailReveal(email);
    }
}

// Local email lookup (when Firebase is not configured)
function handleLocalEmailReveal(email) {
    const emailLower = email.toLowerCase().trim();

    // Find participant by email
    const participant = state.participants.find(p =>
        p.email && p.email.toLowerCase().trim() === emailLower
    );

    if (!participant) {
        showNotFound(email);
        return;
    }

    // Check if already revealed
    if (state.revealedParticipants.includes(participant.id)) {
        showAlreadyRevealed();
        return;
    }

    // Get their match
    const matchId = state.assignments[participant.id];
    const match = state.participants.find(p => p.id === matchId);

    if (!match) {
        showToast('Error finding assignment', 'error');
        return;
    }

    showRevealCard(participant, match);
}

function getEventIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('event');
}

function showLoading() {
    elements.emailRevealSection.style.display = 'none';
    elements.loadingSection.style.display = 'block';
    elements.notFoundSection.style.display = 'none';
    elements.singleRevealContainer.style.display = 'none';
    elements.alreadyRevealed.style.display = 'none';
}

function showRevealCardFromFirebase(assignment, email) {
    // Hide other views, show reveal card
    elements.emailRevealSection.style.display = 'none';
    elements.loadingSection.style.display = 'none';
    elements.notFoundSection.style.display = 'none';
    elements.alreadyRevealed.style.display = 'none';
    elements.singleRevealContainer.style.display = 'flex';

    // Set verified name badge
    elements.verifiedName.textContent = assignment.participantName;

    // Set up the card content
    elements.revealForName.textContent = assignment.participantName;
    elements.revealMatchName.textContent = assignment.matchName;

    if (assignment.matchWishlist) {
        elements.revealMatchWishlist.textContent = `💡 ${assignment.matchWishlist}`;
        elements.revealMatchWishlist.style.display = 'block';
    } else {
        elements.revealMatchWishlist.style.display = 'none';
    }

    if (assignment.budget) {
        elements.revealMatchBudget.textContent = `💰 Budget: $${assignment.budget}`;
        elements.revealMatchBudget.style.display = 'block';
    } else {
        elements.revealMatchBudget.style.display = 'none';
    }

    // Reset card to front
    elements.revealCardLarge.classList.remove('revealed');

    // Bind click to flip card
    elements.revealCardLarge.onclick = () => flipRevealCardSimple();
}

function showRevealCard(participant, match) {
    // Hide other views, show reveal card
    elements.emailRevealSection.style.display = 'none';
    elements.loadingSection.style.display = 'none';
    elements.notFoundSection.style.display = 'none';
    elements.alreadyRevealed.style.display = 'none';
    elements.singleRevealContainer.style.display = 'flex';

    // Set verified name badge
    elements.verifiedName.textContent = participant.name;

    // Set up the card content
    elements.revealForName.textContent = participant.name;
    elements.revealMatchName.textContent = match.name;

    if (match.wishlist) {
        elements.revealMatchWishlist.textContent = `💡 ${match.wishlist}`;
        elements.revealMatchWishlist.style.display = 'block';
    } else {
        elements.revealMatchWishlist.style.display = 'none';
    }

    if (state.event.budget) {
        elements.revealMatchBudget.textContent = `💰 Budget: $${state.event.budget}`;
        elements.revealMatchBudget.style.display = 'block';
    } else {
        elements.revealMatchBudget.style.display = 'none';
    }

    // Reset card to front
    elements.revealCardLarge.classList.remove('revealed');

    // Bind click to flip card
    elements.revealCardLarge.onclick = () => flipRevealCard(participant.id);
}

function showNotFound(email) {
    elements.emailRevealSection.style.display = 'none';
    elements.loadingSection.style.display = 'none';
    elements.singleRevealContainer.style.display = 'none';
    elements.alreadyRevealed.style.display = 'none';
    elements.notFoundSection.style.display = 'block';

    elements.notFoundDetails.textContent = `No participant found with email "${email}". Make sure you're using the same email you were registered with.`;
}

function showAlreadyRevealed() {
    elements.emailRevealSection.style.display = 'none';
    elements.loadingSection.style.display = 'none';
    elements.singleRevealContainer.style.display = 'none';
    elements.notFoundSection.style.display = 'none';
    elements.alreadyRevealed.style.display = 'block';
}

function flipRevealCardSimple() {
    if (elements.revealCardLarge.classList.contains('revealed')) return;

    elements.revealCardLarge.classList.add('revealed');
    triggerConfetti();
    showToast('🎁 Your Secret Santa match is revealed!', 'success');
}

function flipRevealCard(participantId) {
    if (elements.revealCardLarge.classList.contains('revealed')) return;

    elements.revealCardLarge.classList.add('revealed');

    // Mark as revealed and save
    if (!state.revealedParticipants.includes(participantId)) {
        state.revealedParticipants.push(participantId);
        saveToStorage();
    }

    // Trigger confetti
    triggerConfetti();

    showToast('🎁 Your Secret Santa match is revealed!', 'success');
}

function resetRevealView() {
    // Show email section, hide other states
    elements.emailRevealSection.style.display = 'block';
    elements.loadingSection.style.display = 'none';
    elements.singleRevealContainer.style.display = 'none';
    elements.alreadyRevealed.style.display = 'none';
    elements.notFoundSection.style.display = 'none';

    // Clear email input
    elements.revealEmail.value = '';
}

// =====================================
// EXPORT / IMPORT
// =====================================

function exportToJSON() {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        event: state.event,
        participants: state.participants,
        exclusions: state.exclusions,
        assignments: state.assignments
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `secret-santa-${state.event.name || 'export'}.json`.replace(/\s+/g, '-').toLowerCase();
    a.click();

    URL.revokeObjectURL(url);
    elements.exportModal.classList.remove('active');
    showToast('Data exported successfully!', 'success');
}

function copyAssignmentsToClipboard() {
    let text = `🎅 ${state.event.name || 'Secret Santa'} Assignments\n`;
    text += `📅 ${state.event.date || 'TBD'}\n`;
    if (state.event.budget) {
        text += `💰 Budget: $${state.event.budget}\n`;
    }
    text += '\n';

    state.participants.forEach(participant => {
        const matchId = state.assignments[participant.id];
        const match = state.participants.find(p => p.id === matchId);
        if (match) {
            text += `🎁 ${participant.name} → ${match.name}\n`;
        }
    });

    navigator.clipboard.writeText(text).then(() => {
        elements.exportModal.classList.remove('active');
        showToast('Assignments copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
    });
}

function importFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.event) state.event = data.event;
            if (data.participants) state.participants = data.participants;
            if (data.exclusions) state.exclusions = data.exclusions;
            if (data.assignments) {
                state.assignments = data.assignments;
                state.generated = Object.keys(data.assignments).length > 0;
            }
            if (data.revealedParticipants) state.revealedParticipants = data.revealedParticipants;

            updateUI();
            saveToStorage();
            elements.exportModal.classList.remove('active');
            showToast('Data imported successfully!', 'success');
        } catch (err) {
            showToast('Invalid file format', 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// =====================================
// RESET
// =====================================

function resetAll() {
    if (!confirm('Are you sure you want to start over? All data will be lost.')) {
        return;
    }

    state.currentStep = 1;
    state.event = { name: '', date: '', budget: 0, message: '' };
    state.participants = [];
    state.exclusions = [];
    state.assignments = {};
    state.generated = false;
    state.revealedParticipants = [];

    localStorage.removeItem('secretSantaData');

    updateUI();
    goToStep(1);
    showToast('All data cleared. Fresh start!', 'success');
}

// =====================================
// STORAGE
// =====================================

function saveToStorage() {
    const data = {
        currentStep: state.currentStep,
        event: state.event,
        participants: state.participants,
        exclusions: state.exclusions,
        assignments: state.assignments,
        generated: state.generated,
        revealedParticipants: state.revealedParticipants
    };

    localStorage.setItem('secretSantaData', JSON.stringify(data));
}

function loadFromStorage() {
    const saved = localStorage.getItem('secretSantaData');
    if (!saved) return;

    try {
        const data = JSON.parse(saved);

        state.currentStep = data.currentStep || 1;
        state.event = data.event || { name: '', date: '', budget: 0, message: '' };
        state.participants = data.participants || [];
        state.exclusions = data.exclusions || [];
        state.assignments = data.assignments || {};
        state.generated = data.generated || false;
        state.revealedParticipants = data.revealedParticipants || [];
    } catch (err) {
        console.error('Failed to load saved data:', err);
    }
}

function saveEventData() {
    state.event.name = elements.eventName.value;
    state.event.date = elements.eventDate.value;
    state.event.budget = parseFloat(elements.budget.value) || 0;
    state.event.message = elements.eventMessage.value;
}

// =====================================
// UI UPDATE
// =====================================

function updateUI() {
    // Populate event fields
    elements.eventName.value = state.event.name || '';
    elements.eventDate.value = state.event.date || '';
    elements.budget.value = state.event.budget || '';
    elements.eventMessage.value = state.event.message || '';

    // Render lists
    renderParticipants();
    renderExclusions();

    // Go to saved step
    goToStep(state.currentStep);
}

// =====================================
// UTILITY FUNCTIONS
// =====================================

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Keyboard shortcut for shake animation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        elements.exportModal.classList.remove('active');
    }
});

// =====================================
// INITIALIZE APP
// =====================================

document.addEventListener('DOMContentLoaded', init);

// Expose functions for onclick handlers
window.removeParticipant = removeParticipant;
window.removeExclusion = removeExclusion;
