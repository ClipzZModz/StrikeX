const express = require('express');
const router = express.Router();
const SQL = require('../../../../../storage/database');
const db = new SQL();
const dotenv = require('dotenv');

dotenv.config();

// GET /addresses/all
router.get("/", async (req, res) => {
    try {
      const sessionID = req.session.id;
  
      if (!sessionID) {
        return res.status(400).json({ error: "No session ID found." });
      }
  
      db.secureQuery(
        `SELECT data FROM sessions WHERE session_id = ?`,
        [sessionID],
        function(result) {
          if (!result || !result[0]) {
            return res.status(401).json({ error: "Session not found." });
          }
  
          const sessionData = JSON.parse(result[0].data);
          const user = sessionData.user;

          if (!user || !user.id) {
            return res.status(401).json({ error: "Invalid session user." });
          }
  
          db.secureQuery(
            `SELECT * FROM addresses WHERE user_id = ?`,
            [user.id],
            function(addresses) {
              // Defensive: make sure it's an array
              if (!Array.isArray(addresses)) {
                return res.status(500).json({ error: "Failed to fetch addresses." });
              }
  
              
              res.status(200).json(addresses);
            }
          );
        }
      );
    } catch (err) {
      console.error("Error retrieving addresses:", err);
      res.status(500).json({ error: "Failed to get addresses" });
    }
});
  

module.exports = router;
