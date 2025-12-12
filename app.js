// ============================================================
// Shared Application Logic
// ============================================================

// Global variables
const EVENT_ID = "secretsanta2025"; // You can make this dynamic if needed
const ADMIN_PASSCODE = "santa123"; // Change this to your secure passcode

// Utility Functions
const utils = {
  /**
   * Show loading spinner
   */
  showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = `
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      `;
    }
  },

  /**
   * Show error message
   */
  showError(message, elementId = null) {
    const errorHTML = `
      <div class="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
        <strong class="font-bold">Error: </strong>
        <span class="block sm:inline">${message}</span>
      </div>
    `;
    
    if (elementId) {
      document.getElementById(elementId).innerHTML = errorHTML;
    } else {
      alert(message);
    }
  },

  /**
   * Show success message
   */
  showSuccess(message, elementId = null) {
    const successHTML = `
      <div class="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
        <strong class="font-bold">Success: </strong>
        <span class="block sm:inline">${message}</span>
      </div>
    `;
    
    if (elementId) {
      document.getElementById(elementId).innerHTML = successHTML;
    } else {
      alert(message);
    }
  },

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  },

  /**
   * Sanitize input
   */
  sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Firebase Helper Functions
const firebaseHelpers = {
  /**
   * Get event metadata
   */
  async getEvent() {
    try {
      const eventDoc = await db.collection('events').doc(EVENT_ID).get();
      return eventDoc.exists ? eventDoc.data() : null;
    } catch (error) {
      console.error("Error getting event:", error);
      throw error;
    }
  },

  /**
   * Create or update event
   */
  async saveEvent(data) {
    try {
      await db.collection('events').doc(EVENT_ID).set(data, { merge: true });
      return true;
    } catch (error) {
      console.error("Error saving event:", error);
      throw error;
    }
  },

  /**
   * Get all participants
   */
  async getParticipants() {
    try {
      const snapshot = await db.collection('participants')
        .where('eventId', '==', EVENT_ID)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error getting participants:", error);
      throw error;
    }
  },

  /**
   * Get participant by email
   */
  async getParticipantByEmail(email) {
    try {
      const snapshot = await db.collection('participants')
        .where('eventId', '==', EVENT_ID)
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error("Error getting participant by email:", error);
      throw error;
    }
  },

  /**
   * Add participant
   */
  async addParticipant(participantData) {
    try {
      const data = {
        eventId: EVENT_ID,
        name: participantData.name,
        email: participantData.email.toLowerCase(),
        match_name: null,
        match_email: null,
        is_revealed: false,
        wishlist: participantData.wishlist || "",
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('participants').add(data);
      return docRef.id;
    } catch (error) {
      console.error("Error adding participant:", error);
      throw error;
    }
  },

  /**
   * Update participant
   */
  async updateParticipant(participantId, data) {
    try {
      await db.collection('participants').doc(participantId).update(data);
      return true;
    } catch (error) {
      console.error("Error updating participant:", error);
      throw error;
    }
  },

  /**
   * Delete participant
   */
  async deleteParticipant(participantId) {
    try {
      await db.collection('participants').doc(participantId).delete();
      return true;
    } catch (error) {
      console.error("Error deleting participant:", error);
      throw error;
    }
  },

  /**
   * Batch update participants (for matching)
   */
  async batchUpdateParticipants(updates) {
    try {
      const batch = db.batch();
      
      updates.forEach(update => {
        const docRef = db.collection('participants').doc(update.id);
        batch.update(docRef, {
          match_name: update.match_name,
          match_email: update.match_email
        });
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error in batch update:", error);
      throw error;
    }
  }
};

// Make utilities available globally
window.utils = utils;
window.firebaseHelpers = firebaseHelpers;
window.EVENT_ID = EVENT_ID;
window.ADMIN_PASSCODE = ADMIN_PASSCODE;
