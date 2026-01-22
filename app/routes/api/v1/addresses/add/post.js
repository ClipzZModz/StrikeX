const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// MySQL database setup
var SQL = require('../../../../../storage/database');
const db = new SQL();

const dotenv = require('dotenv');

dotenv.config();

// /addresses/add
router.post("/add", async (req, res) => {
  const {
    full_name,
    phone_number,
    address_line1,
    address_line2,
    city,
    region,
    postal_code,
    country,
    is_default
  } = req.body;

  const sessionID = req.session.id;

  try {
    if (!sessionID) {
      return res.status(401).json({ error: "Session ID missing" });
    }

    db.secureQuery(`SELECT data FROM sessions WHERE session_id = ?`, [sessionID], async function (result) {
      if (!result || result.length === 0) {
        return res.status(401).json({ error: "Invalid session" });
      }

      let userId;
      try {
        const sessionData = JSON.parse(result[0].data);
        userId = sessionData.user?.id;

        if (!userId) {
          return res.status(401).json({ error: "User ID not found in session" });
        }
      } catch (parseErr) {
        return res.status(400).json({ error: "Malformed session data" });
      }

      try {
        const userResult = await new Promise((resolve) => {
          db.secureQuery("SELECT * FROM users WHERE id = ?", [userId], (results) => {
            resolve(results[0]);
          });
        });

        if (!userResult) {
          return res.status(401).json({ error: "Unauthorized. Invalid user." });
        }

        const user_id = userResult.id;

        // 🔍 Check for duplicate address
        const existingAddresses = await new Promise((resolve) => {
          db.secureQuery(
            `SELECT * FROM addresses WHERE user_id = ?`,
            [user_id],
            (results) => resolve(results)
          );
        });

        const isDuplicate = existingAddresses.some(addr =>
          addr.full_name === full_name &&
          addr.phone_number === phone_number &&
          addr.address_line1 === address_line1 &&
          addr.address_line2 === address_line2 &&
          addr.city === city &&
          addr.region === region &&
          addr.postal_code === postal_code &&
          addr.country === (country || 'United Kingdom')
        );

        if (isDuplicate) {
          return res.status(200).json({ success: true, message: "Address already exists" });
        }

        // ✅ Clear default if needed
        if (is_default) {
          await new Promise((resolve) => {
            db.secureQuery(
              "UPDATE addresses SET is_default = FALSE WHERE user_id = ?",
              [user_id],
              () => resolve()
            );
          });
        }

        // ➕ Insert new address
        await new Promise((resolve) => {
          db.secureQuery(
            `INSERT INTO addresses 
              (user_id, full_name, phone_number, address_line1, address_line2, city, region, postal_code, country, is_default) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user_id,
              full_name,
              phone_number,
              address_line1,
              address_line2,
              city,
              region,
              postal_code,
              country || 'United Kingdom',
              is_default || false
            ],
            (err, result) => {
              resolve(result);
            }
          );
        });

        res.status(200).json({ success: true, message: "Address added successfully" });
      } catch (innerErr) {
        console.error("Error during address add:", innerErr);
        res.status(500).json({ error: "Internal error while adding address" });
      }
    });

  } catch (err) {
    console.error("Error adding address:", err);
    res.status(500).json({ error: "Failed to add address" });
  }
});

  

module.exports = router;
