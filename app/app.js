const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

require("dotenv").config();

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "StrikeX Storefront" });
});

module.exports = app;
