const express = require("express");
const router = express.Router();
const SQL = require("../../storage/database");
const adminNav = require("../../middleware/adminNav");

const db = new SQL();

router.use(adminNav);

function secureQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.secureQuery(query, params, (rows, err) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

router.get("/admin", async (req, res) => {
  if (!req.session?.user) {
    const redirect = encodeURIComponent("/staff/admin");
    return res.redirect(`/auth/login?redirect_uri=${redirect}`);
  }

  const sessionUser = req.session.user;
  if (sessionUser.auth === "admin") {
    try {
      const [orderTotals, userTotals, ordersCount, recentUsers, recentPaidOrders, recentOrders] = await Promise.all([
        secureQuery(
          "SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE currency = 'GBP'",
          []
        ),
        secureQuery(
          "SELECT COUNT(*) AS total FROM users WHERE auth <> 'admin' OR auth IS NULL",
          []
        ),
        secureQuery("SELECT COUNT(*) AS total FROM orders", []),
        secureQuery(
          "SELECT id, email, first_name, last_name, auth, created_at FROM users WHERE auth <> 'admin' OR auth IS NULL ORDER BY id DESC LIMIT 5",
          []
        ),
        secureQuery(
          "SELECT id, user_id, total_amount, currency, status, payment_status, created_at FROM orders WHERE payment_status = 'paid' ORDER BY created_at DESC LIMIT 5",
          []
        ),
        secureQuery(
          "SELECT id, user_id, total_amount, currency, status, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 5",
          []
        )
      ]);

      const totalIncome = parseFloat(orderTotals?.[0]?.total || 0);
      const dashboardStats = {
        totalIncome: totalIncome.toFixed(2),
        totalIncomeFormatted: `£${totalIncome.toFixed(2)} GBP`,
        newUsers: Number(userTotals?.[0]?.total || 0),
        orders: Number(ordersCount?.[0]?.total || 0),
        openTickets: 0
      };

      return res.render("staff/admin", {
        req,
        title: "StrikeX Admin Dashboard",
        dashboardStats,
        recentUsers,
        recentPaidOrders,
        recentOrders
      });
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
      return res.status(500).send("Unable to load dashboard");
    }
  }

  try {
    const rows = await secureQuery(
      "SELECT auth FROM users WHERE id = ? LIMIT 1",
      [sessionUser.id]
    );
    const auth = rows?.[0]?.auth;
    if (auth !== "admin") {
      return res.status(403).send("Admin access required");
    }

    req.session.user.auth = "admin";
    req.session.save();

    const [orderTotals, userTotals, ordersCount, recentUsers, recentPaidOrders, recentOrders] = await Promise.all([
      secureQuery(
        "SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE currency = 'GBP'",
        []
      ),
      secureQuery(
        "SELECT COUNT(*) AS total FROM users WHERE auth <> 'admin' OR auth IS NULL",
        []
      ),
      secureQuery("SELECT COUNT(*) AS total FROM orders", []),
      secureQuery(
        "SELECT id, email, first_name, last_name, auth, created_at FROM users WHERE auth <> 'admin' OR auth IS NULL ORDER BY id DESC LIMIT 5",
        []
      ),
      secureQuery(
        "SELECT id, user_id, total_amount, currency, status, payment_status, created_at FROM orders WHERE payment_status = 'paid' ORDER BY created_at DESC LIMIT 5",
        []
      ),
      secureQuery(
        "SELECT id, user_id, total_amount, currency, status, payment_status, created_at FROM orders ORDER BY created_at DESC LIMIT 5",
        []
      )
    ]);

    const totalIncome = parseFloat(orderTotals?.[0]?.total || 0);
    const dashboardStats = {
      totalIncome: totalIncome.toFixed(2),
      totalIncomeFormatted: `£${totalIncome.toFixed(2)} GBP`,
      newUsers: Number(userTotals?.[0]?.total || 0),
      orders: Number(ordersCount?.[0]?.total || 0),
      openTickets: 0
    };

    return res.render("staff/admin", {
      req,
      title: "StrikeX Admin Dashboard",
      dashboardStats,
      recentUsers,
      recentPaidOrders,
      recentOrders
    });
  } catch (err) {
    console.error("Failed to load admin auth:", err);
    return res.status(500).send("Unable to verify admin access");
  }
});

module.exports = router;
