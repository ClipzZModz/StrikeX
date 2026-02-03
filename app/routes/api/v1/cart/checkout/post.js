const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const moment = require("moment");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MySQL database setup
var SQL = require("../../../../../storage/database");
const db = new SQL();

function secureQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.secureQuery(query, params, (results, error) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

async function fetchCoupon(code) {
  if (!code) return null;
  const normalized = String(code).trim().toUpperCase();
  if (!normalized) return null;
  const rows = await secureQuery(
    `
      SELECT id, code, percent_off, min_subtotal, active, starts_at, ends_at, usage_limit, times_used
      FROM coupons
      WHERE UPPER(code) = ?
      LIMIT 1
    `,
    [normalized]
  );
  if (!rows.length) return null;
  return rows[0];
}

async function loadCartWithTotals(cartId, userId, sessionId) {
  const cartRows = await secureQuery(
    "SELECT * FROM carts WHERE id = ? AND (user_id = ? OR session_id = ?)",
    [cartId, userId, sessionId]
  );

  if (!cartRows.length) {
    const error = new Error("Cart not found");
    error.status = 404;
    throw error;
  }

  const cart = cartRows[0];
  let cartItems;

  try {
    cartItems = JSON.parse(cart.cart_items || "[]");
  } catch (err) {
    const error = new Error("Invalid cart format");
    error.status = 400;
    throw error;
  }

  const updatedItems = [];
  let totalAmount = 0;
  let currency = "GBP";

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    const error = new Error("Cart is empty");
    error.status = 400;
    throw error;
  }

  for (const item of cartItems) {
    const productRows = await secureQuery(
      "SELECT id, name, uk_price_obj FROM products WHERE id = ?",
      [item.merchandiseId]
    );

    if (!productRows.length) {
      const error = new Error(`Product not found: ${item.merchandiseId}`);
      error.status = 400;
      throw error;
    }

    const product = productRows[0];
    let price;
    let currencyCode;

    try {
      const priceObj = JSON.parse(product.uk_price_obj);
      price = parseFloat(priceObj?.price?.amount);
      currencyCode = priceObj?.price?.currencyCode || "GBP";
    } catch (err) {
      const error = new Error(`Invalid price data for product ${product.id}`);
      error.status = 400;
      throw error;
    }

    const quantity = parseInt(item.quantity, 10);
    if (Number.isNaN(quantity) || quantity <= 0) {
      const error = new Error(`Invalid quantity for product ${product.id}`);
      error.status = 400;
      throw error;
    }

    totalAmount += price * quantity;
    currency = currencyCode;

    updatedItems.push({
      ...item,
      price,
      name: product.name
    });
  }

  return {
    cart,
    updatedItems,
    totalAmount,
    currency
  };
}

router.post("/create-payment-intent", async (req, res) => {
  const { cartId, address, notes, email } = req.body || {};
  let userId = req.session?.user?.id;

  if (!cartId || !address) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { full_name, address_line1, city, postal_code } = address;
  if (!full_name || !address_line1 || !city || !postal_code || !email) {
    return res.status(400).json({ error: "Missing address fields" });
  }

  try {
    // Auto-create or reuse account for guest checkout
    if (!userId) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: "Missing email address" });
      }

      const existingUsers = await secureQuery(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [normalizedEmail]
      );

      let user = existingUsers[0];
      if (user) {
        return res.status(409).json({
          error: "Account exists. Please login to continue.",
          code: "ACCOUNT_EXISTS_LOGIN_REQUIRED"
        });
      }

      if (!user) {
        const tempPassword = crypto.randomBytes(12).toString("base64");
        const hashed = await bcrypt.hash(tempPassword, 10);
        const nameParts = String(full_name || "").trim().split(" ");
        const firstName = nameParts.shift() || "";
        const lastName = nameParts.join(" ") || "";
        const createdAt = moment().format();

        const insertUser = await secureQuery(
          `
            INSERT INTO users (email, password, first_name, last_name, company, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [normalizedEmail, hashed, firstName, lastName, null, req.ip, createdAt]
        );

        const userRows = await secureQuery("SELECT * FROM users WHERE id = ?", [
          insertUser.insertId
        ]);
        user = userRows[0];
      }

      userId = user.id;
      req.session.user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company
      };
      req.session.save();

      // Assign the cart to the newly created or existing user
      await secureQuery("UPDATE carts SET user_id = ? WHERE id = ?", [
        userId,
        cartId
      ]);

      // Store delivery address
      await secureQuery(
        `
          INSERT INTO addresses (user_id, full_name, address_line1, address_line2, city, region, postal_code, country, is_default)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          full_name,
          address_line1,
          null,
          city,
          null,
          postal_code,
          "United Kingdom",
          true
        ]
      );
    }

    const { updatedItems, totalAmount, currency } = await loadCartWithTotals(
      cartId,
      userId,
      req.session?.sessionID
    );

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: "Total amount is invalid" });
    }

    const subtotalAmount = parseFloat(totalAmount.toFixed(2));
    let discountAmount = 0;
    let couponCode = null;

    if (req.session?.couponCode) {
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
        couponCode = coupon.code;
        discountAmount = parseFloat(
          (subtotalAmount * (coupon.percent_off / 100)).toFixed(2)
        );
      } else {
        req.session.couponCode = null;
      }
    }

    const shippingAmount = 0;
    const totalWithDiscount = parseFloat(
      (subtotalAmount - discountAmount + shippingAmount).toFixed(2)
    );

    const users = await secureQuery("SELECT * FROM users WHERE id = ?", [
      userId
    ]);

    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name || ""} ${user.last_name || ""}`.trim()
      });
      stripeCustomerId = customer.id;
      await secureQuery(
        "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
        [stripeCustomerId, userId]
      );
    }

    const orderResult = await secureQuery(
      `
        INSERT INTO orders (
          user_id, cart_id, order_items, subtotal_amount, discount_amount, shipping_amount, total_amount, currency, coupon_code,
          status, payment_status, payment_method, shipping_address, customer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', 'stripe', ?, ?)
      `,
      [
        userId,
        cartId,
        JSON.stringify(updatedItems),
        subtotalAmount.toFixed(2),
        discountAmount.toFixed(2),
        shippingAmount.toFixed(2),
        totalWithDiscount.toFixed(2),
        currency,
        couponCode,
        JSON.stringify(address),
        notes || ""
      ]
    );

    const orderId = orderResult.insertId;
    const amountInPence = Math.round(totalWithDiscount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPence,
      currency: currency.toLowerCase(),
      customer: stripeCustomerId,
      metadata: {
        orderId: String(orderId),
        cartId: String(cartId),
        userId: String(userId)
      }
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      amount: totalWithDiscount,
      currency
    });
  } catch (err) {
    console.error("Stripe PaymentIntent error:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/complete", async (req, res) => {
  const { orderId, paymentIntentId, cartId } = req.body || {};
  const userId = req.session?.user?.id;

  if (!userId || !orderId || !paymentIntentId || !cartId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await secureQuery(
      `
        UPDATE orders
        SET payment_method = 'stripe',
            payment_status = 'paid',
            status = 'processing',
            payment_id = ?
        WHERE id = ? AND user_id = ?
      `,
      [paymentIntentId, orderId, userId]
    );

    // Increment coupon usage if applied
    const orderRows = await secureQuery(
      "SELECT coupon_code FROM orders WHERE id = ? AND user_id = ? LIMIT 1",
      [orderId, userId]
    );
    const couponCode = orderRows?.[0]?.coupon_code;
    if (couponCode) {
      await secureQuery(
        "UPDATE coupons SET times_used = times_used + 1 WHERE UPPER(code) = ?",
        [String(couponCode).toUpperCase()]
      );
    }

    await secureQuery("DELETE FROM carts WHERE id = ? AND user_id = ?", [
      cartId,
      userId
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Order completion error:", err);
    return res.status(500).json({ error: "Failed to finalize order" });
  }
});

module.exports = router;
