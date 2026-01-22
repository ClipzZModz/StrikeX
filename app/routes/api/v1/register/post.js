// routes/api/v1/register/post

const express         = require('express');
const router          = express.Router();


var bcrypt            = require('bcrypt');
const saltRounds      = 10;
var moment            = require("moment");
var Request           = require("request");
const fetch           = require('node-fetch');
var axios             = require("axios");

var middleware        = require('../../../../middleware/middleware');
const dotenv = require('dotenv');

dotenv.config();

//MySQL

var SQL = require('../../../../storage/database');

// Create an instance of SQL
const db = new SQL();

class registerAPI {
  constructor() {

  }

   
  async register(req, res) {
    try {
      const { email, password, firstName, lastName, accountType, company, confirmPassword } = req.body;
  
      if (!email || !password || !firstName || !lastName || (accountType === 'business' && !company)) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }
  
      db.secureQuery('SELECT * FROM users WHERE email = ?', [email], (callback) => {
        if (callback.length > 0) {
          return res.redirect('/auth/register?accountCreation=false');
        }
  
        const recaptcha_url = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${req.body['g-recaptcha-response']}&remoteip=${req.ip}`;
  
        Request(recaptcha_url, function (error, resp, body) {
          if (error) return res.status(500).json({ message: 'reCAPTCHA verification failed' });
  
          body = JSON.parse(body);
          if (!body.success) {
            return res.redirect('/auth/register?fail=true');
          }
  
          bcrypt.hash(password, 10, function (err, hash) {
            if (err) return res.status(500).json({ message: 'Password encryption failed' });
  
            db.secureQuery(`INSERT INTO users (email, password, first_name, last_name, company, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [email, hash, firstName, lastName, accountType === 'business' ? company : null, req.ip, moment().format()], (insertCallback) => {
  
                if (insertCallback.error) return res.status(500).json({ message: 'Database error' });
                return res.redirect('/auth/login?accountCreation=true');
            });
          });
        });
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred during registration.' });
    }
  }

}

const registerAPi = new registerAPI();

router.post('/', (req, res) => registerAPi.register(req, res));
module.exports = router;