const express = require('express');
const router = express.Router();
require('dotenv').config();
const axios = require('axios');
const middleware = require("../../../../middleware/middleware");

// MySQL
var SQL = require('../../../../storage/database');
const db = new SQL();


router.get('/', middleware.verifySession, function(req, res) {
  const searchQuery = req.query.q;

  if (!searchQuery || searchQuery.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const keyword = `%${searchQuery.trim()}%`;

  const sql = `
    SELECT * FROM products
    WHERE name LIKE ? 
       OR category LIKE ?
       OR sku LIKE ?
       OR description LIKE ?
  `;

  db.secureQuery(sql, [keyword, keyword, keyword, keyword], function(results) {
    if (!results || results.length === 0) {
      return res.json({ products: [] });
    }

    // Optionally parse JSON fields if needed
    const products = results.map(product => {
      try {
        product.uk_price_obj = JSON.parse(product.uk_price_obj);
        product.images = JSON.parse(product.images);
      } catch (err) {
        console.error("Error parsing JSON fields in product ID:", product.id);
      }
      return product;
    });

    res.json({ products });
  });
});

module.exports = router;