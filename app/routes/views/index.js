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
        return res.render('index', {
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
      res.render('index', {
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
router.get('/home2', middleware.verifySession, async function(req, res) {
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

// GET Home Page (Final layout)
router.get('/home3', middleware.verifySession, async function(req, res) {
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
        return res.render('index-03', {
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
      res.render('index-03', {
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



router.get('/cart', middleware.verifySession, (req, res) => {
  const session_id = req.session.sessionID;

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

        // Step 4: Render the cart page with updated data
        res.render('cart', {
          req,
          title: 'Cart',
          cartItems,
          cartTotal: cartTotal.toFixed(2),
          checkoutUrl: cartId ? `/checkout/${cartId}` : null,
          error: null
        });
      });
    } else {
      // No cart found for the user
      res.render('cart', {
        req,
        title: 'Cart',
        cartItems,
        cartTotal: cartTotal.toFixed(2),
        checkoutUrl: null,
        error: 'Your cart is empty'
      });
    }
  });
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
