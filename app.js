var express = require('express'),
  session = require('express-session'),
  path = require('path'),
  favicon = require('serve-favicon'),
  logger = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  passport = require('passport'),
  SteamStrategy = require('passport-steam').Strategy,


  index = require('./routes/index'),
  match = require('./routes/match'),
  auth = require("./routes/steam"),
  deposit = require("./routes/deposit"),
  withdraw = require("./routes/withdraw"),

  app = express();





passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

//159.89.23.75
//localhost
//louiselliott.com

passport.use(new SteamStrategy({
  returnURL: 'http://louiselliott.com:80/steam/return',
  realm: 'http://louiselliott.com:80/',
  apiKey: '0A12404D54529629D79D6A49EEFD7660'
},
  function (identifier, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's Steam profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Steam account with a user record in your database,
      // and return that user instead.
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

var appSession = session({
  secret: 'veryniceboratandalsoquitenicewithabitofsalt',
  name: 'skinduel',
  resave: true,
  saveUninitialized: true
});

app.use(appSession);


app.use(passport.initialize());
app.use(passport.session());

//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use("/match", match);
app.use("/steam", auth);
app.use("/deposit", deposit)
app.use("/withdraw", withdraw)

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
}

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = { app: app, session: appSession };
