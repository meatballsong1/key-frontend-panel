require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


const API_BASE = "https://tradeskey-backend.onrender.com/";

// Middleware to get auth token
app.use((req, res, next) => {
    res.locals.authToken = req.cookies.auth_token || "";
    next();
});

// The real `notification.mp3` is served from `public/notification.mp3` via express.static
// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Explicit routes for homepage, login, and dashboard
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));

// Fallback: serve index (home) for unknown GETs
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Frontend server running on http://localhost:${PORT}`));

