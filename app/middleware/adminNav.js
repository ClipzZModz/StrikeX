module.exports = function adminNav(req, res, next) {
  const path = req.path || "";
  let active = "dashboard";

  if (path.startsWith("/admin")) {
    active = "dashboard";
  }

  res.locals.adminNavActive = active;
  next();
};
