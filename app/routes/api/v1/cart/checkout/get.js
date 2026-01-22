const express = require('express');
const router = express.Router();

// MySQL database setup
var SQL = require('../../../../../storage/database');
const db = new SQL();

const dotenv = require('dotenv');

dotenv.config();

router.get('/:cartId', async (req, res) => {
  const cartId = req.params.cartId;
  const sessionId = req.session.sessionID;
  const user = req.session.user;

  db.secureQuery('SELECT user_id, session_id, cart_items FROM carts WHERE id = ?', [cartId], async (result, error) => {
    if (error || result.length === 0) {
      return res.status(400).json({ error: 'Cart not found' });
    }

    const cart = result[0];

    // 🔒 Authorization: Check session ID or user ID
    const isLoggedIn = !!user?.id;
    const isCartOwnedByUser = isLoggedIn && user.id === cart.user_id;
    const isCartOwnedBySession = cart.session_id === sessionId;

    if (!isCartOwnedByUser && !isCartOwnedBySession) {
      return res.status(403).json({ error: 'Unauthorized access to cart' });
    }

    if (!cart.cart_items || cart.cart_items === '[]') {
      return res.redirect('/cart?empty=true');
    }

    let cartItems;
    try {
      cartItems = JSON.parse(cart.cart_items);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid cart items' });
    }

    // 🛒 Fetch and update product details
    const updatedItems = [];
    let totalAmount = 0;
    let currency = null;

    try {
      for (const item of cartItems) {
        const productResult = await new Promise((resolve, reject) => {
          db.secureQuery(
            'SELECT uk_price_obj, images FROM products WHERE id = ?',
            [item.merchandiseId],
            (result, error) => {
              if (error || result.length === 0) reject(new Error('Product not found'));
              else resolve(result[0]);
            }
          );
        });

        const priceData = typeof productResult.uk_price_obj === 'string'
          ? JSON.parse(productResult.uk_price_obj)
          : productResult.uk_price_obj;

        const priceObj = priceData?.price;
        if (!priceObj || !priceObj.amount || !priceObj.currencyCode) {
          return res.status(400).json({ error: `Invalid price data for product ${item.merchandiseId}` });
        }

        const amount = parseFloat(priceObj.amount);
        const itemCurrency = priceObj.currencyCode;

        if (!currency) currency = itemCurrency;
        else if (currency !== itemCurrency) {
          return res.status(400).json({ error: 'Mixed currencies in cart' });
        }

        const images = typeof productResult.images === 'string'
          ? JSON.parse(productResult.images)
          : productResult.images;

        const imageUrl = images?.[0]?.url || item.image;

        const subtotal = amount * item.quantity;
        totalAmount += subtotal;

        updatedItems.push({
          merchandiseId: item.merchandiseId,
          quantity: item.quantity,
          title: item.title,
          price: amount,
          currency: itemCurrency,
          image: imageUrl
        });
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
      return res.status(500).json({ error: 'Failed to fetch product details' });
    }

    const itemsJson = JSON.stringify(updatedItems);

    // 💳 Fetch addresses if logged in
    if (isLoggedIn) {
      db.secureQuery('SELECT * FROM addresses WHERE user_id = ?', [user.id], (addresses, error) => {
        if (error) {
          console.error('Error fetching addresses:', error);
          return res.status(500).json({ error: 'Failed to load addresses' });
        }

        res.render('checkout', {
          title: 'StrikeX - Checkout',
          itemsJson,
          req,
          totalAmount,
          currency,
          addresses,
          cartId,
          stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
        });
      });
    } else {

      res.redirect(`/auth/login?loginMsg=true&redirect_uri=${req.originalUrl}`);

    }
  });
});

router.get('/product/:productID', async (req, res) => {
  db.secureQuery('SELECT * FROM products WHERE name = ?', [req.params.productID], async (product) => {
    
    db.secureQuery('SELECT cart_items FROM carts WHERE session_id = ?', [req.session.sessionID], async (qty) => {
      let totalCartItems = 0;

      try {
        const cartItems = JSON.parse(qty[0].cart_items || '[]');
        totalCartItems = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      } catch (err) {
        console.error('Error parsing cart_items:', err);
      }

      res.status(200).json({
        status: 200,
        version: 'v1',
        productData: product,
        totalCartItems
      });
    });
    
  });
});


module.exports = router;
