const admin = require('firebase-admin');

// To run this app properly, you need to download a service account JSON file
// from your Firebase Console (Project Settings -> Service Accounts -> Generate new private key)
// and set its path in the .env file.

let db = null;

try {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log("Firebase initialized successfully.");
} catch (error) {
    console.error("Firebase initialization error (Ensure you have firebase-key.json):", error.message);
    // Dummy DB for testing without Firebase key initially
    db = {
        collection: (name) => ({
            get: async () => ({ docs: [] }),
            add: async (data) => ({ id: "dummy_id" }),
            doc: (id) => ({
                get: async () => ({ exists: false, data: () => ({}) }),
                update: async (data) => true,
                delete: async () => true
            })
        })
    };
    console.log("Using Mock Firebase DB for now.");
}

module.exports = { db, admin };
