const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const Stripe = require("stripe");

require("dotenv").config();

const getRealIP = require("./utils/getRealIP");
const SQL = require("./storage/database");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const db = new SQL();
db.initialise(() => {
  console.log("[MySQL]: Initialization Complete");
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

app.use(getRealIP);
app.use(logger("dev"));
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).send("Missing Stripe webhook secret");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Stripe webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId) {
        db.secureQuery(
          `
            UPDATE orders
            SET payment_method = 'stripe',
                payment_status = 'paid',
                status = 'processing',
                payment_id = ?
            WHERE id = ?
          `,
          [paymentIntent.id, orderId],
          () => {}
        );
      }
    }

    res.json({ received: true });
  }
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_SCHEMA
});

app.use(
  session({
    key: "strikex_login_session",
    secret: process.env.SESSION_SECRET || "change-me",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

const index_view = require("./routes/views/index");
const account_view = require("./routes/views/account");
const checkout_view = require("./routes/api/v1/cart/checkout/get");
const checkout_view_post = require("./routes/api/v1/cart/checkout/post");

const api_index = require("./routes/api/v1/index");
const login_get_api = require("./routes/api/v1/login/get");
const login_post_api = require("./routes/api/v1/login/post");
const register_get_api = require("./routes/api/v1/register/get");
const register_post_api = require("./routes/api/v1/register/post");
const address_post_api = require("./routes/api/v1/addresses/add/post");
const address_all_get_api = require("./routes/api/v1/addresses/all/get");
const cartRoutes = require("./routes/api/v1/cart/post");
const searchRoutes = require("./routes/api/v1/search/get");
const contactRoutes = require("./routes/api/v1/contact/post");

app.use("/", index_view);
app.use("/account", account_view);
app.use("/checkout", checkout_view);
app.use("/checkout", checkout_view_post);

app.use("/api/v1", api_index);
app.use("/auth/login", login_get_api);
app.use("/auth/login", login_post_api);
app.use("/auth/register", register_get_api);
app.use("/auth/register", register_post_api);
app.use("/addresses", address_post_api);
app.use("/addresses/all", address_all_get_api);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/contact", contactRoutes);

app.use((req, res) => {
  res.status(404).render("error");
});

module.exports = app;
