const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer'); // For sending OTP emails
const crypto = require('crypto'); // For generating random OTPs
const app = express();

// In-memory user storage
let users = [];

// Temporary storage for OTPs
let otpStorage = {};

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Middleware
app.use(
  session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true,
  })
);

// Dummy Mail Transporter for OTPs
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'ramshekade20@gmail.com', // Replace with your email
    pass: 'euts gamr imdh ikum', // Replace with your password or app-specific password
  },
});

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user || null });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = users.find((u) => u.email === email);
  if (!user || user.password !== password) {
    return res.render('login', { error: 'Invalid email or password' });
  }

  // Save user session and redirect to home
  req.session.user = user;
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  // Check if email already exists
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    return res.render('register', { error: 'Email already exists' });
  }

  // Add user to in-memory array
  users.push({ username, email, password });
  res.redirect('/login');
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null });
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  // Check if email exists in the database
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.render('forgot-password', { error: 'No user found with this email.' });
  }

  // Generate OTP and store it
  const otp = crypto.randomInt(1000, 9999); // Generate a 4-digit OTP
  otpStorage[email] = {
    otp,
    attempts: 0, // Count for regeneration attempts
    expires: Date.now() + 5 * 60 * 1000, // OTP expires in 5 minutes
  };

  // Send OTP to user's email
  transporter.sendMail(
    {
      from: 'your-email@gmail.com', // Replace with your email
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}`,
    },
    (err) => {
      if (err) {
        console.error(err);
        return res.render('forgot-password', { error: 'Error sending OTP. Please try again later.' });
      }

      req.session.email = email; // Save email to session
      res.redirect('/verify-otp');
    }
  );
});

app.get('/verify-otp', (req, res) => {
  if (!req.session.email) return res.redirect('/forgot-password');
  res.render('verify-otp', { error: null });
});

app.post('/verify-otp', (req, res) => {
  const { otp } = req.body;
  const email = req.session.email;
  const storedOtp = otpStorage[email];

  if (!storedOtp || Date.now() > storedOtp.expires) {
    return res.render('verify-otp', { error: 'OTP has expired. Please regenerate.' });
  }

  if (parseInt(otp) !== storedOtp.otp) {
    return res.render('verify-otp', { error: 'Invalid OTP. Please try again.' });
  }

  delete otpStorage[email]; // Remove OTP after successful verification
  res.redirect('/reset-password');
});

app.post('/regenerate-otp', (req, res) => {
  const email = req.session.email;
  const storedOtp = otpStorage[email];

  if (!storedOtp) {
    return res.redirect('/forgot-password');
  }

  if (storedOtp.attempts >= 3) {
    return res.render('verify-otp', { error: 'Maximum OTP regeneration attempts reached.' });
  }

  // Wait 20 seconds before allowing regeneration
  if (storedOtp.nextRegeneration && Date.now() < storedOtp.nextRegeneration) {
    return res.render('verify-otp', { error: 'Please wait before regenerating OTP.' });
  }

  // Generate new OTP
  const otp = crypto.randomInt(1000, 9999);
  otpStorage[email] = {
    ...storedOtp,
    otp,
    attempts: storedOtp.attempts + 1,
    nextRegeneration: Date.now() + 20 * 1000, // 20 seconds cooldown
  };

  transporter.sendMail(
    {
      from: 'your-email@gmail.com',
      to: email,
      subject: 'New OTP for Password Reset',
      text: `Your new OTP for password reset is: ${otp}`,
    },
    (err) => {
      if (err) {
        console.error(err);
        return res.render('verify-otp', { error: 'Error sending OTP. Please try again later.' });
      }

      res.render('verify-otp', { error: 'A new OTP has been sent to your email.' });
    }
  );
});

app.get('/reset-password', (req, res) => {
  const successMessage = req.query.success ? req.query.success : null; // If success message exists in the query, use it
  if (!req.session.email) return res.redirect('/forgot-password');
  res.render('reset-password', { error: null, success: successMessage });
});


app.post('/reset-password', (req, res) => {
  const { password } = req.body;
  const email = req.session.email;

  // Update user's password
  const user = users.find((u) => u.email === email);
  if (user) {
    user.password = password;  // Update password in the user data
    delete req.session.email;  // Clear the session email

    // Show a success message and redirect to login page
    return res.redirect('/reset-password?success=Password reset successful. You can now log in with your new password.');
  } else {
    return res.render('reset-password', { error: 'Error updating password. Please try again.', success: null });
  }
});


// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

