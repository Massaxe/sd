var express = require('express');
var router = express.Router();

router.get('/*', function(req, res, next) {
  res.render('match', { user: req.user });
});

/*router.get('/*', ensureAuthenticated, function(req, res, next) {
  res.render('match', { user: req.user });
});*/

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
}

module.exports = router;
