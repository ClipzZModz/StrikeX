// routes/api/v1/index

const express         = require('express');
const router          = express.Router();
//const apiKeyValidator = require('./middleware/apiKeyValidator');

//var middleware        = require('../../../middleware/middleware');
const dotenv = require('dotenv');

dotenv.config();

class indexAPi {
  constructor() {

  }

  async register(req, res) {
    try {
       
      res.render('register', { site_key: process.env.RECAPTCHA_site, req, title: 'Express' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while communicating with the API!', error: error.message });
    }
  }



}

const indexAPI = new indexAPi();

router.get('/', (req, res) => indexAPI.register(req, res));
module.exports = router;