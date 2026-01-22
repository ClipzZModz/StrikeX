// routes/api/v1/index

const express         = require('express');
const router          = express.Router();
//const apiKeyValidator = require('./middleware/apiKeyValidator');

middleware        = require('../../../middleware/middleware');


class indexAPi {
  constructor() {

  }

  async hello(req, res) {
    try {
       
        return res.status(200).json({
            message: 'Hello! You\'ve reached the v1 store API, if you\'re a developer and wish to implement our API into your business, please let us know!',
            status: 200,
            version: 'v1'
        });
       

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while communicating with the API!', error: error.message });
    }
  }



}

const indexAPI = new indexAPi();

router.get('/', middleware.verifySession, (req, res) => indexAPI.hello(req, res));
module.exports = router;