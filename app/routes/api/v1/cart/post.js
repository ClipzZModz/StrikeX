const express = require('express');
const router = express.Router();

// MySQL database setup
var SQL = require('../../../../storage/database');
const db = new SQL();

// Create or fetch a cart
router.post('/create', (req, res) => {
  const userId = req.session.user?.id || null;
  const sessionId = req.session.sessionID;

  // First check if there's an existing cart for this user or session
  const lookupQuery = 'SELECT id FROM carts WHERE user_id = ? OR session_id = ? LIMIT 1';
  db.secureQuery(lookupQuery, [userId, sessionId], (existingCart, lookupErr) => {
    if (lookupErr) {
      console.error('Error looking up cart:', lookupErr);
      return res.status(500).json({ error: 'Failed to look up cart' });
    }

    if (existingCart.length > 0) {
      const existingCartId = existingCart[0].id;
      if (userId) req.session.user.cartId = existingCartId;
      return res.json({ cartId: existingCartId.toString(), checkoutUrl: `/checkout/${existingCartId}` });
    }

    // No existing cart, create new
    const cartItems = JSON.stringify([]);
    const lastUpdated = new Date().toISOString();
    const createQuery = 'INSERT INTO carts (user_id, session_id, cart_items, last_updated) VALUES (?, ?, ?, ?)';

    db.secureQuery(createQuery, [userId, sessionId, cartItems, lastUpdated], (result, error) => {
      if (error) {
        console.error('Error creating cart:', error);
        return res.status(500).json({ error: 'Failed to create cart' });
      }

      const cartId = result.insertId;
      if (userId) req.session.user.cartId = cartId;

      res.json({ cartId: cartId.toString(), checkoutUrl: `/checkout/${cartId}` });
    });
  });
});


// Add an item to the cart
router.post('/add', (req, res) => {
  const { variantId, quantity } = req.body;


  console.log(quantity)

  if (!variantId || variantId.trim() === '') {
    return res.status(400).json({ error: 'Invalid product variant ID' });
  }

  const userId = req.session.user?.id || null;
  const sessionId = req.session.sessionID;

  const getProductDetails = (id) => new Promise((resolve, reject) => {
    db.secureQuery('SELECT name, uk_price_obj, images FROM products WHERE id = ?', [id], (result, error) => {
      if (error || result.length === 0) reject(error || new Error('Product not found'));
      else resolve(result[0]);
    });
  });

  const processCart = (cartId) => {
    db.secureQuery('SELECT cart_items FROM carts WHERE id = ?', [cartId], async (result, error) => {
      if (error || result.length === 0) {
        return res.status(400).json({ error: 'Cart not found' });
      }

      let cartItems = JSON.parse(result[0].cart_items || '[]');
      try {
        const product = await getProductDetails(variantId);
        const priceObj = JSON.parse(product.uk_price_obj);
        const images = JSON.parse(product.images);

        const existingItemIndex = cartItems.findIndex(item => item.merchandiseId === variantId);
        if (existingItemIndex > -1) {
          cartItems[existingItemIndex].quantity += parseInt(quantity);
        } else {
          cartItems.push({
            merchandiseId: variantId,
            quantity: parseInt(quantity),
            title: product.name,
            price: priceObj.amount,
            currency: priceObj.currencyCode,
            image: images[0]?.url || 'assets/images/default.jpg'
          });
        }

        const updateQuery = 'UPDATE carts SET cart_items = ?, last_updated = ? WHERE id = ?';
        const lastUpdated = new Date().toISOString();
        db.secureQuery(updateQuery, [JSON.stringify(cartItems), lastUpdated, cartId], (updateResult, updateError) => {
          if (updateError) {
            console.error('Error updating cart:', updateError);
            return res.status(500).json({ error: 'Failed to update cart' });
          }

          res.json({
            message: 'Item added to cart',
            cart: { id: cartId.toString(), lines: { edges: cartItems.map(item => ({ node: item })) } }
          });
        });
      } catch (err) {
        console.error('Error adding item:', err);
        res.status(500).json({ error: 'Failed to fetch product details' });
      }
    });
  };

  // Lookup or create the cart before processing
  const lookupQuery = 'SELECT id FROM carts WHERE user_id = ? OR session_id = ? LIMIT 1';
  db.secureQuery(lookupQuery, [userId, sessionId], (existingCart, lookupErr) => {
    if (lookupErr) {
      console.error('Error checking for existing cart:', lookupErr);
      return res.status(500).json({ error: 'Failed to check cart' });
    }

    if (existingCart.length > 0) {
      processCart(existingCart[0].id);
    } else {
      const lastUpdated = new Date().toISOString();
      const createQuery = 'INSERT INTO carts (user_id, session_id, cart_items, last_updated) VALUES (?, ?, ?, ?)';
      db.secureQuery(createQuery, [userId, sessionId, JSON.stringify([]), lastUpdated], (result, error) => {
        if (error) {
          return res.status(500).json({ error: 'Failed to create cart' });
        }
        processCart(result.insertId);
      });
    }
  });
});

// Cart summary for header dropdown
router.get('/summary', (req, res) => {
  const userId = req.session.user?.id || null;
  const sessionId = req.session.sessionID || null;

  if (!userId && !sessionId) {
    return res.json({ items: [], subtotal: 0, count: 0, currency: 'GBP' });
  }

  const lookupQuery = 'SELECT id, cart_items FROM carts WHERE user_id = ? OR session_id = ? LIMIT 1';
  db.secureQuery(lookupQuery, [userId, sessionId], async (cartResult, cartErr) => {
    if (cartErr) {
      console.error('Error fetching cart summary:', cartErr);
      return res.status(500).json({ error: 'Failed to fetch cart' });
    }

    if (!cartResult.length) {
      return res.json({ items: [], subtotal: 0, count: 0, currency: 'GBP', cartId: null });
    }

    let cartItems = [];
    try {
      cartItems = JSON.parse(cartResult[0].cart_items || '[]');
    } catch (err) {
      console.error('Invalid cart_items JSON:', err);
      return res.json({ items: [], subtotal: 0, count: 0, currency: 'GBP', cartId: cartResult[0]?.id || null });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.json({ items: [], subtotal: 0, count: 0, currency: 'GBP', cartId: cartResult[0]?.id || null });
    }

    const productIds = cartItems.map(item => item.merchandiseId).filter(Boolean);
    const productMap = new Map();

    if (productIds.length) {
      db.secureQuery('SELECT id, name, description, category, uk_price_obj, images FROM products WHERE id IN (?)', [productIds], (productRows) => {
        productRows.forEach((product) => {
          let price = 0;
          let currency = 'GBP';
          try {
            const priceObj = JSON.parse(product.uk_price_obj || '{}');
            price = parseFloat(priceObj?.price?.amount ?? priceObj?.amount ?? 0);
            currency = priceObj?.price?.currencyCode || priceObj?.currencyCode || 'GBP';
          } catch (err) {
            price = 0;
          }

          let image = null;
          try {
            const images = JSON.parse(product.images || '[]');
            image = images?.[0]?.url || null;
          } catch (err) {
            image = null;
          }

          productMap.set(product.id.toString(), {
            title: product.name,
            description: product.description,
            category: product.category,
            price,
            currency,
            image
          });
        });

        let subtotal = 0;
        let count = 0;
        let currency = 'GBP';

        const items = cartItems.map((item) => {
          const product = productMap.get(item.merchandiseId?.toString()) || {};
          const price = parseFloat(product.price ?? item.price ?? 0) || 0;
          const qty = parseInt(item.quantity, 10) || 1;
          const itemCurrency = product.currency || item.currency || 'GBP';
          currency = itemCurrency;
          count += qty;
          subtotal += price * qty;

          return {
            id: item.merchandiseId,
            title: item.title || item.name || product.title || 'Unnamed Product',
            description: product.description || item.description || '',
            category: product.category || item.category || '',
            price,
            quantity: qty,
            currency: itemCurrency,
            image: item.image || product.image || ''
          };
        });

        return res.json({ items, subtotal, count, currency, cartId: cartResult[0]?.id || null });
      });
    } else {
      return res.json({ items: [], subtotal: 0, count: 0, currency: 'GBP', cartId: cartResult[0]?.id || null });
    }
  });
});


// View cart contents
router.get('/view', (req, res) => {
  const cartId = req.session.user?.cartId || req.query.cartId;

  if (!cartId) {
    return res.status(400).json({ error: 'No active cart found' });
  }

  db.secureQuery('SELECT cart_items FROM carts WHERE id = ?', [cartId], (result, error) => {
    if (error || result.length === 0) {
      console.error('Error fetching cart:', error);
      return res.status(404).json({ error: 'Cart not found' });
    }

    const cartItems = JSON.parse(result[0].cart_items || '[]');
    const formattedItems = cartItems.map(item => ({
      node: {
        merchandise: {
          id: item.merchandiseId,
          title: item.title,
          product: {
            title: item.title,
            images: { edges: [{ node: { src: item.image, altText: null } }] }
          }
        },
        quantity: item.quantity
      }
    }));

    res.json({
      cart: {
        id: cartId.toString(),
        checkoutUrl: `/checkout/${cartId}`,
        lines: { edges: formattedItems }
      }
    });
  });
});

// Remove an item from the cart
router.post('/remove', (req, res) => {
  const { productId } = req.body;
  const userId = req.session.user?.id || null;
  const sessionId = req.session.sessionID || null;

  if (!productId || productId.trim() === '') {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  const lookupQuery = 'SELECT id, cart_items FROM carts WHERE user_id = ? OR session_id = ? LIMIT 1';
  db.secureQuery(lookupQuery, [userId, sessionId], (result, error) => {
    if (error || result.length === 0) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const cartId = result[0].id;
    let cartItems = JSON.parse(result[0].cart_items || '[]');
    const itemIndex = cartItems.findIndex(item => item.merchandiseId === productId);

    if (itemIndex === -1) {
      return res.status(400).json({ error: 'Product not found in cart' });
    }

    cartItems.splice(itemIndex, 1); // Remove the item
    const updateQuery = 'UPDATE carts SET cart_items = ?, last_updated = ? WHERE id = ?';
    const lastUpdated = new Date().toISOString();

    db.secureQuery(updateQuery, [JSON.stringify(cartItems), lastUpdated, cartId], (updateResult, updateError) => {
      if (updateError) {
        console.error('Error removing item:', updateError);
        return res.status(500).json({ error: 'Failed to remove item' });
      }
      res.json({
        message: 'Product removed successfully',
        cart: { id: cartId.toString(), lines: { edges: cartItems.map(item => ({ node: item })) } }
      });
    });
  });
});

// Create a checkout (simplified for database)
async function createCheckout(cartId) {
  return new Promise((resolve, reject) => {
    db.secureQuery('SELECT cart_items FROM carts WHERE id = ?', [cartId], (result, error) => {
      if (error || result.length === 0) {
        console.error('Error fetching cart for checkout:', error);
        reject(new Error('Cart not found'));
        return;
      }

      const checkout = {
        id: cartId.toString(),
        webUrl: `/checkout/${cartId}` // Simulated checkout URL
      };
      resolve(checkout);
    });
  });
}

module.exports = router;
