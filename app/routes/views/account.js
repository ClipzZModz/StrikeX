const express = require('express');
const router = express.Router();
require('dotenv').config();
const axios = require('axios');
const moment = require('moment');
var middleware = require("../../middleware/middleware");



// MySQL
var SQL = require('../../storage/database');
const db = new SQL();



// GET Account Page
router.get('/', middleware.verifySession, async function(req, res) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  try {
    let orders = [];
    let wishlist = [];

    try {
      // Query the orders table for the logged-in user's orders
      await db.secureQuery(
        `
        SELECT 
          id,
          created_at AS date,
          total_amount AS total,
          currency,
          status
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [req.session.user.id] // Use user ID from session
      ,function(result) {

        // Flatten and format the orders to match the EJS template expectations
        orders = result.map(order => ({
          id: order.id,
          date: order.date, // Already a TIMESTAMP, will be formatted in EJS with moment
          total: `${order.total} ${order.currency}`, // Combine amount and currency
          status: order.status
        }));

        console.log('Fetched Orders:', orders);


        recommendedProducts = [{"merchandiseId":"1","title":"Plastic trttttttt","image":"https://m.media-amazon.com/images/I/51YDKW65ujL._AC_UF894,1000_QL80_.jpg"}, {"merchandiseId":"2","title":"Plastic trttttttt","image":"https://m.media-amazon.com/images/I/51YDKW65ujL._AC_UF894,1000_QL80_.jpg"}, {"merchandiseId":"3","title":"Plastic trttttttt","image":"https://m.media-amazon.com/images/I/51YDKW65ujL._AC_UF894,1000_QL80_.jpg"}, {"merchandiseId":"4","title":"Plastic trttttttt","image":"https://m.media-amazon.com/images/I/51YDKW65ujL._AC_UF894,1000_QL80_.jpg"}, {"merchandiseId":"5","title":"Plastic trttttttt","image":"https://m.media-amazon.com/images/I/51YDKW65ujL._AC_UF894,1000_QL80_.jpg"}]

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
          const renderAccount = (addresses = []) => {
            return res.render('account', {
              req,
              moment,
              site_key: process.env.RECAPTCHA_site,
              title: 'StrikeX Customer Account',
              orders,
              wishlist,
              recommendedProducts: [],
              user: req.session.user,
              recommendedProducts,
              cartItems,
              addresses
            });
          };

          if (cartItems.length === 0) {
            db.secureQuery(
              'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
              [req.session.user.id],
              (addresses) => renderAccount(addresses || [])
            );
            return;
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

          db.secureQuery(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
            [req.session.user.id],
            (addresses) => renderAccount(addresses || [])
          );
        });


      });

    } catch (error) {
      console.error('Error fetching orders from database:', error.message);
    } 

  } catch (error) {
    console.error('Error fetching account data:', error.message);
    res.status(500).send('Error loading account data');
  }
});


// GET Orders 
router.get('/order/:orderId', middleware.verifySession, async function(req, res) {
  const orderId = req.params.orderId;
  if (!orderId) return res.status(400).json({ status: 'error', code: '400' });
  return res.redirect(`/order/${orderId}`);
});





module.exports = router;
