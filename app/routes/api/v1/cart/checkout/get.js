const express = require('express');
const router = express.Router();

// MySQL database setup
var SQL = require('../../../../../storage/database');
const db = new SQL();

const dotenv = require('dotenv');

dotenv.config();

async function fetchCoupon(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return null;
  return await new Promise((resolve, reject) => {
    db.secureQuery(
      `
        SELECT id, code, percent_off, min_subtotal, active, starts_at, ends_at, usage_limit, times_used
        FROM coupons
        WHERE UPPER(code) = ?
        LIMIT 1
      `,
      [normalized],
      (rows, error) => {
        if (error) return reject(error);
        if (!rows || rows.length === 0) return resolve(null);
        return resolve(rows[0]);
      }
    );
  });
}

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
            'SELECT name, category, description, uk_price_obj, images FROM products WHERE id = ?',
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
          title: item.title || productResult.name,
          description: productResult.description,
          firstTag: productResult.category,
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

    const subtotalAmount = parseFloat(totalAmount.toFixed(2));
    let discountAmount = 0;
    let couponApplied = null;
    let couponMessage = null;

    if (req.session?.couponCode) {
      try {
        const coupon = await fetchCoupon(req.session.couponCode);
        const now = new Date();
        const minSubtotal = parseFloat(coupon?.min_subtotal || 0);
        const isValid =
          coupon &&
          coupon.active &&
          subtotalAmount >= minSubtotal &&
          (!coupon.starts_at || new Date(coupon.starts_at) <= now) &&
          (!coupon.ends_at || new Date(coupon.ends_at) >= now) &&
          (coupon.usage_limit === null || coupon.times_used < coupon.usage_limit);

        if (isValid) {
          couponApplied = coupon.code;
          discountAmount = parseFloat((subtotalAmount * (coupon.percent_off / 100)).toFixed(2));
        } else {
          req.session.couponCode = null;
          couponMessage = 'Coupon removed: subtotal below minimum or inactive.';
        }
      } catch (err) {
        console.error('Coupon lookup error:', err);
        couponMessage = 'Unable to validate coupon right now.';
      }
    }

    const shippingAmount = 0;
    const grandTotal = parseFloat((subtotalAmount - discountAmount + shippingAmount).toFixed(2));

    const renderCheckout = (addresses = []) => res.render('checkout', {
      title: 'StrikeX - Checkout',
      itemsJson,
      items: updatedItems,
      req,
      totalAmount: grandTotal,
      subtotalAmount,
      discountAmount,
      shippingAmount,
      currency,
      couponApplied,
      couponMessage,
      addresses,
      cartId,
      isLoggedIn,
      authRedirect: `/auth/register?redirect_uri=${encodeURIComponent(req.originalUrl)}`,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });

    // Fetch addresses if logged in, else render as guest
    if (isLoggedIn) {
      db.secureQuery('SELECT * FROM addresses WHERE user_id = ?', [user.id], (addresses, error) => {
        if (error) {
          console.error('Error fetching addresses:', error);
          return res.status(500).json({ error: 'Failed to load addresses' });
        }

        return renderCheckout(addresses);
      });
    } else {
      return renderCheckout([]);
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
