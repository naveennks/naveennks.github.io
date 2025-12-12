// ============================================================
// Admin Dashboard Logic
// ============================================================

// State
let currentParticipants = [];

// ============================================================
// Passcode Authentication
// ============================================================

document.getElementById('passcodeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const passcode = document.getElementById('passcodeInput').value;
  
  if (passcode === ADMIN_PASSCODE) {
    // Store in session
    sessionStorage.setItem('adminAuth', 'true');
    showDashboard();
  } else {
    utils.showError('Invalid passcode. Please try again.', 'passcodeError');
    document.getElementById('passcodeInput').value = '';
  }
});

function showDashboard() {
  document.getElementById('passcodeScreen').classList.add('hidden');
  document.getElementById('mainDashboard').classList.remove('hidden');
  initializeDashboard();
}

function logout() {
  sessionStorage.removeItem('adminAuth');
  location.reload();
}

// Check if already authenticated
if (sessionStorage.getItem('adminAuth') === 'true') {
  showDashboard();
}

// ============================================================
// Dashboard Initialization
// ============================================================

async function initializeDashboard() {
  await loadEventSettings();
  await loadParticipants();
  updateStatusBoard();
}

// ============================================================
// Event Setup
// ============================================================

async function loadEventSettings() {
  try {
    const event = await firebaseHelpers.getEvent();
    if (event) {
      document.getElementById('organizerName').value = event.organizerName || '';
      document.getElementById('eventDate').value = event.eventDate || '';
      document.getElementById('eventTime').value = event.eventTime || '';
      document.getElementById('minBudget').value = event.minBudget || 1000;
      document.getElementById('maxBudget').value = event.maxBudget || 1500;
    }
  } catch (error) {
    console.error('Error loading event:', error);
  }
}

document.getElementById('eventSetupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const organizerName = document.getElementById('organizerName').value.trim();
  const eventDate = document.getElementById('eventDate').value;
  const eventTime = document.getElementById('eventTime').value;
  const minBudget = parseInt(document.getElementById('minBudget').value);
  const maxBudget = parseInt(document.getElementById('maxBudget').value);
  
  if (minBudget > maxBudget) {
    utils.showError('Minimum budget cannot be greater than maximum budget.', 'eventSetupMessage');
    return;
  }
  
  try {
    await firebaseHelpers.saveEvent({
      organizerName: organizerName,
      eventId: EVENT_ID,
      eventDate: eventDate,
      eventTime: eventTime,
      minBudget: minBudget,
      maxBudget: maxBudget,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    utils.showSuccess('Event settings saved successfully!', 'eventSetupMessage');
    setTimeout(() => {
      document.getElementById('eventSetupMessage').innerHTML = '';
    }, 3000);
  } catch (error) {
    utils.showError('Failed to save event settings.', 'eventSetupMessage');
  }
});

// ============================================================
// Participant Management
// ============================================================

document.getElementById('addParticipantForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('participantName').value.trim();
  const email = document.getElementById('participantEmail').value.trim();
  const wishlist = document.getElementById('participantWishlist').value.trim();
  
  // Validate email
  if (!utils.isValidEmail(email)) {
    utils.showError('Please enter a valid email address.', 'addParticipantMessage');
    return;
  }
  
  try {
    // Check if email already exists
    const existing = await firebaseHelpers.getParticipantByEmail(email);
    if (existing) {
      utils.showError('A participant with this email already exists.', 'addParticipantMessage');
      return;
    }
    
    // Add participant
    await firebaseHelpers.addParticipant({
      name,
      email,
      wishlist
    });
    
    utils.showSuccess(`${name} added successfully!`, 'addParticipantMessage');
    
    // Reset form
    document.getElementById('addParticipantForm').reset();
    
    // Reload participants list
    await loadParticipants();
    
    setTimeout(() => {
      document.getElementById('addParticipantMessage').innerHTML = '';
    }, 3000);
    
  } catch (error) {
    utils.showError('Failed to add participant. Please try again.', 'addParticipantMessage');
  }
});

async function loadParticipants() {
  utils.showLoading('participantsLoading');
  
  try {
    currentParticipants = await firebaseHelpers.getParticipants();
    displayParticipants();
    updateStatusBoard();
  } catch (error) {
    utils.showError('Failed to load participants.', 'participantsList');
  } finally {
    document.getElementById('participantsLoading').innerHTML = '';
  }
}

function displayParticipants() {
  const container = document.getElementById('participantsList');
  
  if (currentParticipants.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <p class="text-lg">No participants yet</p>
        <p class="text-sm">Add participants using the form above</p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="space-y-3">';
  
  currentParticipants.forEach(participant => {
    const hasMatch = participant.match_name ? '✅' : '❌';
    const isRevealed = participant.is_revealed ? '👁️' : '🔒';
    
    html += `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition duration-200">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="font-semibold text-gray-800">${utils.sanitize(participant.name)}</h3>
            <p class="text-sm text-gray-600">${utils.sanitize(participant.email)}</p>
            
            ${participant.wishlist ? `
              <p class="text-sm text-gray-500 mt-1">
                <span class="font-medium">Wishlist:</span> ${utils.sanitize(participant.wishlist)}
              </p>
            ` : ''}
            
            ${participant.match_name ? `
              <p class="text-sm text-green-600 mt-2 font-medium">
                ${hasMatch} Matched with: ${utils.sanitize(participant.match_name)}
                ${isRevealed} ${participant.is_revealed ? 'Revealed' : 'Not revealed yet'}
              </p>
            ` : `
              <p class="text-sm text-gray-400 mt-2">Not yet matched</p>
            `}
          </div>
          
          <button 
            onclick="deleteParticipant('${participant.id}', '${utils.sanitize(participant.name)}')"
            class="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

async function deleteParticipant(id, name) {
  if (!confirm(`Are you sure you want to delete ${name}?`)) {
    return;
  }
  
  try {
    await firebaseHelpers.deleteParticipant(id);
    utils.showSuccess(`${name} deleted successfully!`, 'participantsList');
    await loadParticipants();
  } catch (error) {
    utils.showError('Failed to delete participant.', 'participantsList');
  }
}

// ============================================================
// Matching Algorithm
// ============================================================

async function runMatching() {
  if (!confirm('Are you sure you want to run the matching algorithm? This will assign Secret Santa matches to all participants.')) {
    return;
  }
  
  const btn = document.getElementById('runMatchingBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Running algorithm...';
  
  utils.showLoading('matchingMessage');
  
  try {
    // Get fresh participant data
    const participants = await firebaseHelpers.getParticipants();
    
    if (participants.length < 3) {
      utils.showError('You need at least 3 participants to run the matching algorithm.', 'matchingMessage');
      btn.disabled = false;
      btn.textContent = '🎁 Run Matching Algorithm';
      return;
    }
    
    // Run the matching algorithm
    const matches = generateMatches(participants);
    
    if (!matches) {
      utils.showError('Failed to generate valid matches. Please try again.', 'matchingMessage');
      btn.disabled = false;
      btn.textContent = '🎁 Run Matching Algorithm';
      return;
    }
    
    // Batch update Firestore
    await firebaseHelpers.batchUpdateParticipants(matches);
    
    utils.showSuccess(`Successfully matched ${matches.length} participants! 🎉`, 'matchingMessage');
    
    // Reload participants
    await loadParticipants();
    
    setTimeout(() => {
      document.getElementById('matchingMessage').innerHTML = '';
    }, 5000);
    
  } catch (error) {
    console.error('Matching error:', error);
    utils.showError('An error occurred while running the matching algorithm.', 'matchingMessage');
  } finally {
    btn.disabled = false;
    btn.textContent = '🎁 Run Matching Algorithm';
  }
}

/**
 * Generate Secret Santa matches
 * Uses a simple shuffle algorithm to randomly assign matches
 */
function generateMatches(participants) {
  const maxAttempts = 1000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Create a shuffled copy of participants
    const givers = [...participants];
    const receivers = [...participants];
    
    // Shuffle receivers
    shuffleArray(receivers);
    
    const matches = [];
    const used = new Set();
    let valid = true;
    
    for (let i = 0; i < givers.length; i++) {
      const giver = givers[i];
      let matched = false;
      
      for (let j = 0; j < receivers.length; j++) {
        const receiver = receivers[j];
        
        // Check if valid match (not matching to self)
        if (
          !used.has(receiver.id) &&
          receiver.id !== giver.id
        ) {
          matches.push({
            id: giver.id,
            match_name: receiver.name,
            match_email: receiver.email
          });
          used.add(receiver.id);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        valid = false;
        break;
      }
    }
    
    if (valid && matches.length === participants.length) {
      return matches;
    }
  }
  
  return null;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ============================================================
// Status Board
// ============================================================

function updateStatusBoard() {
  const container = document.getElementById('statusBoard');
  
  if (currentParticipants.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <p>No participants to display</p>
      </div>
    `;
    return;
  }
  
  const matched = currentParticipants.filter(p => p.match_name).length;
  const revealed = currentParticipants.filter(p => p.is_revealed).length;
  const total = currentParticipants.length;
  
  let html = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-blue-50 rounded-lg p-4 text-center">
        <p class="text-3xl font-bold text-blue-600">${total}</p>
        <p class="text-sm text-gray-600">Total Participants</p>
      </div>
      <div class="bg-green-50 rounded-lg p-4 text-center">
        <p class="text-3xl font-bold text-green-600">${matched}</p>
        <p class="text-sm text-gray-600">Matched</p>
      </div>
      <div class="bg-purple-50 rounded-lg p-4 text-center">
        <p class="text-3xl font-bold text-purple-600">${revealed}</p>
        <p class="text-sm text-gray-600">Revealed</p>
      </div>
    </div>
  `;
  
  if (matched > 0) {
    html += '<div class="space-y-2">';
    currentParticipants.forEach(participant => {
      if (participant.match_name) {
        const status = participant.is_revealed ? 
          '<span class="text-green-600">✅ Revealed</span>' : 
          '<span class="text-orange-600">🔒 Not Revealed</span>';
        
        html += `
          <div class="flex justify-between items-center py-2 border-b border-gray-200">
            <span class="font-medium">${utils.sanitize(participant.name)}</span>
            ${status}
          </div>
        `;
      }
    });
    html += '</div>';
  }
  
  container.innerHTML = html;
}

// Auto-refresh status every 30 seconds
setInterval(() => {
  if (sessionStorage.getItem('adminAuth') === 'true') {
    loadParticipants();
  }
}, 30000);

// ============================================================
// Import Participants from CSV
// ============================================================

async function importParticipants() {
  const fileInput = document.getElementById('csvFileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    utils.showError('Please select a CSV file to import.', 'importMessage');
    return;
  }
  
  if (!file.name.endsWith('.csv')) {
    utils.showError('Please upload a valid CSV file.', 'importMessage');
    return;
  }
  
  utils.showLoading('importMessage');
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const csvContent = e.target.result;
      // Handle different line endings (CRLF, LF, CR)
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      let startIndex = 0;
      
      // Check if first line is a header (contains "name" or "email" in first two fields)
      if (lines.length > 0) {
        const firstLine = lines[0].toLowerCase().trim();
        if (firstLine.includes('name') && (firstLine.includes('email') || firstLine.includes('e-mail'))) {
          startIndex = 1; // Skip header row
        }
      }
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Remove any BOM (Byte Order Mark) characters
        const cleanLine = line.replace(/^\uFEFF/, '');
        
        // Try robust CSV parsing with multiple fallback strategies
        let parts = [];
        
        // Strategy 1: Handle proper CSV with quoted fields
        if (cleanLine.includes('"')) {
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < cleanLine.length; j++) {
            const char = cleanLine[j];
            const nextChar = j < cleanLine.length - 1 ? cleanLine[j + 1] : null;
            
            if (char === '"' && nextChar === '"') {
              // Escaped quote (two consecutive quotes)
              current += '"';
              j++; // Skip next quote
            } else if (char === '"') {
              // Toggle quote state
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              parts.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          parts.push(current);
        } else {
          // Strategy 2: Simple comma split for non-quoted CSV
          parts = cleanLine.split(',');
        }
        
        // Clean up all parts: remove quotes, trim whitespace
        const cleanedParts = parts.map(part => {
          return part
            .replace(/^["'\s]+|["'\s]+$/g, '') // Remove leading/trailing quotes and spaces
            .trim();
        }).filter(part => part.length > 0); // Only keep non-empty parts
        
        if (cleanedParts.length < 2) {
          errors.push(`Line ${i + 1}: Invalid format - found ${cleanedParts.length} field(s), need at least name and email. Raw content: "${cleanLine.substring(0, 100)}"`);
          errorCount++;
          continue;
        }
        
        const name = cleanedParts[0];
        const email = cleanedParts[1];
        const wishlist = cleanedParts.length > 2 ? cleanedParts[2] : '';
        
        if (!name || !email) {
          errors.push(`Line ${i + 1}: Name and email are required`);
          errorCount++;
          continue;
        }
        
        if (!utils.isValidEmail(email)) {
          errors.push(`Line ${i + 1}: Invalid email format`);
          errorCount++;
          continue;
        }
        
        try {
          // Check if participant already exists
          const existing = await firebaseHelpers.getParticipantByEmail(email);
          if (existing) {
            errors.push(`Line ${i + 1}: Email ${email} already exists`);
            errorCount++;
            continue;
          }
          
          // Add participant
          await firebaseHelpers.addParticipant({
            name,
            email,
            wishlist
          });
          
          successCount++;
        } catch (error) {
          errors.push(`Line ${i + 1}: ${error.message}`);
          errorCount++;
        }
      }
      
      // Show results
      let message = `<div class="space-y-2">`;
      
      if (successCount > 0) {
        message += `
          <div class="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded">
            <strong>Success:</strong> ${successCount} participant(s) imported successfully!
          </div>
        `;
      }
      
      if (errorCount > 0) {
        message += `
          <div class="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Errors:</strong> ${errorCount} participant(s) failed to import.
            <details class="mt-2">
              <summary class="cursor-pointer font-medium">View errors</summary>
              <ul class="mt-2 text-sm list-disc list-inside">
                ${errors.map(err => `<li>${utils.sanitize(err)}</li>`).join('')}
              </ul>
            </details>
          </div>
        `;
      }
      
      message += `</div>`;
      
      document.getElementById('importMessage').innerHTML = message;
      
      // Clear file input
      fileInput.value = '';
      
      // Reload participants list
      await loadParticipants();
      
      setTimeout(() => {
        document.getElementById('importMessage').innerHTML = '';
      }, 10000);
      
    } catch (error) {
      console.error('Import error:', error);
      utils.showError('Failed to process CSV file. Please check the format.', 'importMessage');
    }
  };
  
  reader.onerror = () => {
    utils.showError('Failed to read file.', 'importMessage');
  };
  
  reader.readAsText(file);
}
