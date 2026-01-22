const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

// Encryption configuration
const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const iv = crypto.randomBytes(16); // Initialization vector

// Encrypt a password
function encryptPassword(password) {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
    let encrypted = cipher.update(password);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
        iv: iv.toString('hex'), // Save IV alongside the encrypted password
        encryptedData: encrypted.toString('hex')
    };
}

module.exports = encryptPassword;