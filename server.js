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

// Fallback for SPA routes: serve index.html for unknown GETs (optional)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

