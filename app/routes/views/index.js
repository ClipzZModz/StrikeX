const express = require('express');
const router = express.Router();
require('dotenv').config();
const axios = require('axios');
const middleware = require("../../middleware/middleware");

// MySQL
var SQL = require('../../storage/database');
const db = new SQL();

// Reusable function to fetch products by category
async function fetchProductsByTag(category) {
  return new Promise((resolve, reject) => {
    // Log the original and encoded category for debugging
    console.log('Original Category:', category);
    const encodedCategory = encodeURIComponent(category);
    console.log('Encoded Category:', encodedCategory);

    // SQL query to fetch products by category
    const query = `
      SELECT 
        id,
        sku,
        name,
        category,
        quantity,
        quantity_sold,
        description,
        uk_price_obj,
        images,
        status
      FROM products 
      WHERE category = ?
      LIMIT 20
    `;

    db.secureQuery(query, [category], (result, error) => {
      if (error) {
        console.error(`Error fetching products with category ${category}:`, error);
        return reject(new Error('Database query failed'));
      }

      if (!result || result.length === 0) {
        console.log(`No products found for category ${category}`);
        return resolve([]);
      }

      // Map the database results to a structured format
      const products = result.map(product => {
        // Parse the uk_price_obj (assuming it's a JSON string)
        let priceObj = JSON.parse(product.uk_price_obj);


        // Parse the images (assuming it's a JSON string array)
        let imageArray;
        try {
          imageArray = JSON.parse(product.images);
          if (!Array.isArray(imageArray)) {
            throw new Error('Images field is not an array');
          }
        } catch (parseError) {
          console.error(`Error parsing images for product ${product.id}:`, parseError);
          imageArray = [{ url: 'No Image' }]; // Default fallback
        }

        return {
          id: product.id.toString(), // Convert to string for consistency
          title: product.name,
          description: product.description,
          images: imageArray.map(img => ({ url: img.url || 'No Image' })), // Map to array of objects
          variantId: product.sku, // Using SKU as a variant-like identifier
          price: priceObj,
          rating: null, // Add rating field to schema if needed later
          firstTag: product.category // Using category as the "tag"
        };
      });

      resolve(products);
    });
  });
}

// Example usage
router.get('/products/:category', middleware.verifySession, async (req, res) => {
  try {
    const products = await fetchProductsByTag(req.params.category);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Home Page
router.get('/', middleware.verifySession, async function(req, res) {
  try {
    const [softLureProducts, softDropshopProducts, plasticJerkbaitLures] = await Promise.all([
      fetchProductsByTag('soft-paddle-lures'),
      fetchProductsByTag('soft-dropshop-lures'),
      fetchProductsByTag('plastic-jerkbait-lures'),
    ]);

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
        return res.render('index-02', {
          plastic_jerkbait_lures: plasticJerkbaitLures,
          soft_dropshop_products: softDropshopProducts,
          soft_lure_products: softLureProducts,
          req,
          title: 'Express',
          cartItems,
          site_key: process.env.RECAPTCHA_site
        });
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

      // Now render page
      res.render('index-02', {
        plastic_jerkbait_lures: plasticJerkbaitLures,
        soft_dropshop_products: softDropshopProducts,
        soft_lure_products: softLureProducts,
        req,
        title: 'Express',
        cartItems,
        site_key: process.env.RECAPTCHA_site
      });
    });

  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).send('Error loading products');
  }
});

// GET Home Page (Alt layout)
router.get('/home2', (req, res) => {
  res.redirect('/');
});

router.get('/cart', middleware.verifySession, (req, res) => {
  const session_id = req.session.sessionID;

  const getCoupon = (code, callback) => {
    if (!code) return callback(null, null);
    const key = String(code).trim().toUpperCase();
    if (!key) return callback(null, null);

    db.secureQuery(
      `
        SELECT id, code, percent_off, min_subtotal, active, starts_at, ends_at, usage_limit, times_used
        FROM coupons
        WHERE UPPER(code) = ?
        LIMIT 1
      `,
      [key],
      (rows, err) => {
        if (err) return callback(err, null);
        if (!rows || rows.length === 0) return callback(null, null);
        return callback(null, rows[0]);
      }
    );
  };

  // Step 1: Get the cart for the user
  db.secureQuery('SELECT id, cart_items FROM carts WHERE session_id = ? LIMIT 1', [session_id], (cartResult) => {

    let cartId = null;
    let cartItems = [];
    let cartTotal = 0;

    if (cartResult.length > 0) {
      cartId = cartResult[0].id;
      cartItems = JSON.parse(cartResult[0].cart_items || '[]');

      if (cartItems.length === 0) {
        return res.render('cart', {
          req,
          title: 'Cart',
          cartItems,
          cartTotal: cartTotal.toFixed(2),
          cartSubtotal: cartTotal.toFixed(2),
          cartDiscount: '0.00',
          cartGrandTotal: cartTotal.toFixed(2),
          couponApplied: null,
          couponMessage: null,
          checkoutUrl: cartId ? `/checkout/${cartId}` : null,
          error: 'Your cart is empty'
        });
      }

      // Step 2: Fetch current prices for all products in the cart
      const productIds = cartItems.map(item => item.merchandiseId);
      const productQuery = 'SELECT id, uk_price_obj FROM products WHERE id IN (?)';
      
      db.secureQuery(productQuery, [productIds], (productResult) => {


        console.log(`Product Res:`, productResult)

        // Create a map of product ID to price object
        const priceMap = new Map();
        productResult.forEach(product => {
          try {
            const priceObj = JSON.parse(product.uk_price_obj);
            priceMap.set(product.id.toString(), {
              price: parseFloat(priceObj.price.amount).toFixed(2),
              currency: priceObj.price.currencyCode || 'GBP'
            });
          } catch (parseError) {
            console.error(`Error parsing uk_price_obj for product ${product.id}:`, parseError);
            priceMap.set(product.id.toString(), { price: '0.00', currency: 'GBP' }); // Fallback
          }
        });

        // Step 3: Update cartItems with current prices and calculate total
        cartItems = cartItems.map(item => {
          const priceData = priceMap.get(item.merchandiseId) || { price: '0.00', currency: 'GBP' };
          const updatedItem = {
            ...item,
            price: priceData.price, // Update price
            currency: priceData.currency // Add currency
          };
          cartTotal += parseFloat(updatedItem.price) * updatedItem.quantity;
          return updatedItem;
        });

        const subtotal = parseFloat(cartTotal.toFixed(2));
        let discount = 0;
        let couponApplied = null;
        let couponMessage = req.session?.couponMessage || null;
        if (req.session) req.session.couponMessage = null;

        const finalizeRender = () => {
          const grandTotal = parseFloat((subtotal - discount).toFixed(2));
          res.render('cart', {
            req,
            title: 'Cart',
            cartItems,
            cartTotal: cartTotal.toFixed(2),
            cartSubtotal: subtotal.toFixed(2),
            cartDiscount: discount.toFixed(2),
            cartGrandTotal: grandTotal.toFixed(2),
            couponApplied,
            couponMessage,
            checkoutUrl: cartId ? `/checkout/${cartId}` : null,
            error: null
          });
        };

        if (req.session?.couponCode) {
          getCoupon(req.session.couponCode, (couponErr, coupon) => {
            if (couponErr) {
              console.error('Coupon lookup error:', couponErr);
              couponMessage = 'Unable to validate coupon right now.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            if (!coupon || !coupon.active) {
              couponMessage = 'Coupon not recognized or inactive.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            const now = new Date();
            if (coupon.starts_at && new Date(coupon.starts_at) > now) {
              couponMessage = 'Coupon is not active yet.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            if (coupon.ends_at && new Date(coupon.ends_at) < now) {
              couponMessage = 'Coupon has expired.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
              couponMessage = 'Coupon usage limit reached.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            if (subtotal < parseFloat(coupon.min_subtotal || 0)) {
              couponMessage = 'Coupon removed: subtotal below minimum.';
              req.session.couponCode = null;
              return finalizeRender();
            }

            discount = parseFloat((subtotal * (coupon.percent_off / 100)).toFixed(2));
            couponApplied = coupon.code;
            return finalizeRender();
          });
        } else {
          finalizeRender();
        }
      });
    } else {
      // No cart found for the user
      res.render('cart', {
        req,
        title: 'Cart',
        cartItems,
        cartTotal: cartTotal.toFixed(2),
        cartSubtotal: cartTotal.toFixed(2),
        cartDiscount: '0.00',
        cartGrandTotal: cartTotal.toFixed(2),
        couponApplied: null,
        couponMessage: null,
        checkoutUrl: null,
        error: 'Your cart is empty'
      });
    }
  });
});

router.post('/cart/coupon', middleware.verifySession, (req, res) => {
  const code = String(req.body?.coupon_code || '').trim();
  if (!code) {
    req.session.couponCode = null;
    req.session.couponMessage = null;
    return res.redirect('/cart');
  }

  const normalized = code.toUpperCase();

  db.secureQuery(
    `
      SELECT id, code, percent_off, min_subtotal, active, starts_at, ends_at, usage_limit, times_used
      FROM coupons
      WHERE UPPER(code) = ?
      LIMIT 1
    `,
    [normalized],
    (rows, err) => {
      if (err) {
        console.error('Coupon lookup error:', err);
        req.session.couponCode = null;
        req.session.couponMessage = 'Unable to validate coupon right now.';
        return res.redirect('/cart');
      }

      if (!rows || rows.length === 0 || !rows[0].active) {
        req.session.couponCode = null;
        req.session.couponMessage = 'Coupon not recognized or inactive.';
        return res.redirect('/cart');
      }

      const coupon = rows[0];
      const now = new Date();
      if (coupon.starts_at && new Date(coupon.starts_at) > now) {
        req.session.couponCode = null;
        req.session.couponMessage = 'Coupon is not active yet.';
        return res.redirect('/cart');
      }

      if (coupon.ends_at && new Date(coupon.ends_at) < now) {
        req.session.couponCode = null;
        req.session.couponMessage = 'Coupon has expired.';
        return res.redirect('/cart');
      }

      if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
        req.session.couponCode = null;
        req.session.couponMessage = 'Coupon usage limit reached.';
        return res.redirect('/cart');
      }

      req.session.couponCode = normalized;
      req.session.couponMessage = 'Coupon applied. Minimum £10 subtotal required.';
      return res.redirect('/cart');
    }
  );
});

router.get('/order/:orderId', middleware.verifySession, (req, res) => {
  if (!req.session?.user) {
    const redirect = encodeURIComponent(req.originalUrl || `/order/${req.params.orderId}`);
    return res.redirect(`/auth/login?redirect_uri=${redirect}`);
  }

  const orderId = req.params.orderId;
  if (!orderId) {
    return res.status(400).send('Missing order id');
  }

  db.secureQuery(
    `
      SELECT *
      FROM orders
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [orderId, req.session.user.id],
    (rows, err) => {
      if (err) {
        console.error('Error fetching order:', err);
        return res.status(500).send('Failed to load order');
      }

      if (!rows || rows.length === 0) {
        return res.status(404).send('Order not found');
      }

      const order = rows[0];
      let orderItems = [];
      let shippingAddress = null;

      try {
        orderItems = JSON.parse(order.order_items || '[]');
      } catch (parseError) {
        console.error('Error parsing order items:', parseError);
      }

      try {
        shippingAddress = order.shipping_address
          ? JSON.parse(order.shipping_address)
          : null;
      } catch (parseError) {
        console.error('Error parsing shipping address:', parseError);
      }

      res.render('view_order', {
        req,
        title: `Order #${order.id}`,
        order,
        orderItems,
        shippingAddress
      });
    }
  );
});



router.get('/products/:category/:product_name', middleware.verifySession, function(req, res) {
  // Extract parameters from the URL
  const category = req.params.category;
  const product_name = req.params.product_name;

  console.log('Fetching product for category:', category);
  console.log('Fetching product for name:', product_name);

  // Define the SQL query to fetch the product
  const query = 'SELECT * FROM products WHERE name = ? AND category = ? LIMIT 1';

  // Execute the secure database query
  db.secureQuery(query, [product_name, category], (result, error) => {
    // Handle database errors
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Check if a product was found
    if (result.length === 0) {
      console.error('Error: Product not found.');
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Get the first (and only) product from the result
    const product = result[0];

    // Parse the uk_price_obj (stored as JSON string)
    let priceObj = JSON.parse(product.uk_price_obj);
   
    // Parse the images (stored as JSON string)
    let images;
    try {
      images = JSON.parse(product.images).map(img => img.url);
    } catch (parseError) {
      console.error('Error parsing images:', parseError);
      // Default to an empty array if parsing fails
      images = [];
    }

    // Construct a single variant object (since your database doesn't support multiple variants)
    const variant = {
      id: product.id.toString(), // Convert to string for consistency
      title: 'Default', // Standard title for single-variant products
      price: priceObj.price.amount, // Price amount as a string
      compareAtPrice: null, // No compare-at price in your schema
      currency: priceObj.price.currencyCode, // Currency code (e.g., 'GBP')
      availableForSale: product.quantity > 0 && product.status === 'active', // Availability check
      sku: product.sku // SKU from the database
    };

    console.log(variant)

    // Set a timestamp for createdAt and updatedAt (since not in schema)
    const now = new Date().toISOString();

    // Construct the product data object for the view
    const productData = {
      id: product.id.toString(), // Convert to string
      title: product.name, // Use name as title
      description: `${product.description}`, // Wrap plain text in <p> tags for basic HTML
      descriptionText: product.description, // Plain text version
      productType: 'default', // Default value (not in schema)
      vendor: null, // Not in schema
      tags: [product.category], // Use category as a tag
      createdAt: now, // Current timestamp
      updatedAt: now, // Current timestamp
      images: images, // Array of image URLs
      variants: [variant], // Array with single variant
      reviews: [], // Empty array (not in schema)
      metafields: [] // Empty array (not in schema)
    };

    // Render the cart_single view with the product data

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
        return res.render('cart_single', {
          req, // Pass the request object
          title: 'Cart - ' + productData.title, // Page title
          product: productData, // Product data object
          cartItems
        });
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

      return res.render('cart_single', {
        req, // Pass the request object
        title: 'Cart - ' + productData.title, // Page title
        product: productData, // Product data object
        cartItems
      });
    });

  });
});

module.exports = router;
