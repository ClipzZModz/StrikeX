const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

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

async function loadCartWithTotals(cartId, userId) {
  const cartRows = await secureQuery(
    "SELECT * FROM carts WHERE id = ? AND user_id = ?",
    [cartId, userId]
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
  const { cartId, address, notes } = req.body || {};
  const userId = req.session?.user?.id;

  if (!userId || !cartId || !address) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { full_name, address_line1, city, postal_code } = address;
  if (!full_name || !address_line1 || !city || !postal_code) {
    return res.status(400).json({ error: "Missing address fields" });
  }

  try {
    const { updatedItems, totalAmount, currency } = await loadCartWithTotals(
      cartId,
      userId
    );

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: "Total amount is invalid" });
    }

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
          user_id, cart_id, order_items, total_amount, currency,
          status, payment_status, payment_method, shipping_address, customer_notes
        ) VALUES (?, ?, ?, ?, ?, 'pending', 'unpaid', 'stripe', ?, ?)
      `,
      [
        userId,
        cartId,
        JSON.stringify(updatedItems),
        totalAmount.toFixed(2),
        currency,
        JSON.stringify(address),
        notes || ""
      ]
    );

    const orderId = orderResult.insertId;
    const amountInPence = Math.round(totalAmount * 100);

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
      amount: totalAmount,
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
