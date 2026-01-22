// routes/api/v1/index

const express         = require('express');
const router          = express.Router();
//const apiKeyValidator = require('./middleware/apiKeyValidator');

//var middleware        = require('../../../middleware/middleware');
const dotenv = require('dotenv');

dotenv.config();


// MySQL
var SQL = require('../../../../storage/database');
const db = new SQL();

class indexAPi {
  constructor() {

  }

  async login(req, res) {
    try {

      if(req.session.user) return res.redirect('/account');
       

    // Fetch cart items
    db.secureQuery(`SELECT cart_items FROM carts WHERE session_id = ?`, [req.session.sessionID], async function(results) {
      let cartItems = [];

      results.forEach(row => {
        if (row.cart_items) {
          try {
            const items = JSON.parse(row.cart_items); // Expecting array of item objects
            cartItems.push(...items);
          } catch (e) {
            console.error("Error parsing cart_items:", e);
          }
        }
      });

      // If no items, render immediately
      if (cartItems.length === 0) {
        res.render('login', { site_key: process.env.RECAPTCHA_site, req, title: 'Express', cartItems });
      }

      // Get prices for each cart item using their merchandiseId
      await Promise.all(cartItems.map(async (item) => {
        return new Promise((resolve) => {
          db.secureQuery(`SELECT uk_price_obj FROM products WHERE id = ?`, [item.merchandiseId], function(productResults) {
            try {
              if (productResults.length > 0) {
                const price = JSON.parse(productResults[0].uk_price_obj).price.amount;
                item.price = parseFloat(price).toFixed(2);
              } else {
                item.price = null;
              }
            } catch (e) {
              console.error("Error parsing price for item ID:", item.merchandiseId, e);
              item.price = null;
            }
            resolve();
          });
        });
      }));

      console.log(cartItems)

      res.render('login', { site_key: process.env.RECAPTCHA_site, req, title: 'Express', cartItems });
    });



    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while communicating with the API!', error: error.message });
    }
  }



}

const indexAPI = new indexAPi();

router.get('/', (req, res) => indexAPI.login(req, res));
module.exports = router;