// MongoDB Initialization Script for Ragleaf
// This script runs when MongoDB container starts for the first time

print('Starting Ragleaf MongoDB initialization...');

// Switch to the Ragleaf database
db = db.getSiblingDB('rag-webui-chat');

// Create collections with initial structure
db.createCollection('conversations');
db.createCollection('messages');
db.createCollection('users');
db.createCollection('sessions');

// Create indexes for better performance
db.conversations.createIndex({ "userId": 1, "createdAt": -1 });
db.messages.createIndex({ "conversationId": 1, "createdAt": 1 });
db.users.createIndex({ "email": 1 }, { unique: true });
db.sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.sessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// Insert default data
db.users.insertOne({
    _id: ObjectId(),
    email: "admin@ragwebui.local",
    name: "Ragleaf AI Admin",
    role: "admin",
    createdAt: new Date(),
    preferences: {
        theme: "light",
        language: "tr",
        ragMode: true,
        chatMode: true
    }
});

print('Ragleaf MongoDB initialization completed successfully!');
