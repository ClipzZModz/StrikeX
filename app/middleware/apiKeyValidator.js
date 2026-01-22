require('dotenv').config();
const APP_API_KEY = `Bearer ${process.env.APP_API_KEY}`;

//MySQL

var SQL = require('../storage/database');

// Create an instance of SQL
const db = new SQL();

module.exports = {

    verify: function(req, res, next){

      try {
        var API_KEY = req.headers['authorization'];
        if(!API_KEY) {
          if(!req.session.user) API_KEY = 'None';
          else API_KEY = req.session.user.API_KEY;
        }

        if (API_KEY && API_KEY === APP_API_KEY) {
          next(); // Key is valid
        } else {
          
          db.secureQuery(`SELECT * FROM api_keys WHERE access = ?`, [`${API_KEY.replace("Bearer ", "")}`], (callback) => {
            console.log(callback)
            if(callback.length === 0) return res.status(401).json({ message: 'Invalid API key.' });

            if(callback[0].status === 'expired') return res.status(401).json({ message: 'API key expired.' });

            let array = JSON.stringify(callback[0].authorised_urls);
            let reqURL = req.originalUrl.split('?')[0];
            
            if (array.includes(reqURL)) next();
            
            else {
              console.log(`Access to ${req.originalUrl} denied via ${req.realIP}`)
              return res.status(401).json({ message: 'API key not authorised to access this endpoint.' });
            }

          });
        }
      } catch(e) {
        console.log(`Error while verifing API key: `, e)
      }

    }
}