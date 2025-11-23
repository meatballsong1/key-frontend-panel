require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const API_BASE = "https://tradeskey-backend.onrender.com/";

// Middleware to get auth token
app.use((req, res, next) => {
    res.locals.authToken = req.cookies.auth_token || "";
    next();
});

// -------------------- ROUTES --------------------

// Home/Login page
app.get("/", (req, res) => {
    res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
    try {
        const token = req.body.token;
        const response = await axios.post(`${API_BASE}/login`, { token });
        res.cookie("auth_token", response.data.token, { httpOnly: true });
        res.redirect("/panel");
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.render("login", { error: "Invalid token" });
    }
});

// Panel with tabs
app.get("/panel", async (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.redirect("/");

    try {
        const authEnabledRes = await axios.get(`${API_BASE}/settings/auth-enabled`);
        res.render("panel", { authEnabled: authEnabledRes.data.authEnabled });
    } catch (err) {
        console.error(err);
        res.render("panel", { authEnabled: true });
    }
});

// Generate keys
app.post("/generate", async (req, res) => {
    try {
        const { amount, type } = req.body;
        const response = await axios.get(`${API_BASE}/generate`, {
            params: { amount, type },
        });
        res.json(response.data);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "Failed to generate keys" });
    }
});

// List keys
app.get("/keys", async (req, res) => {
    try {
        const type = req.query.type || "all";
        const token = req.cookies.auth_token;
        const response = await axios.get(`${API_BASE}/keys`, {
            params: { type },
            headers: { "x-login-token": token },
        });
        res.render("keys", { keys: response.data.keys, type });
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send("Failed to fetch keys");
    }
});

// Modify key
app.post("/keys/:key/modify", async (req, res) => {
    try {
        const { key } = req.params;
        const { type } = req.body;
        const token = req.cookies.auth_token;
        await axios.put(`${API_BASE}/keys/${key}`, { type }, { headers: { "x-login-token": token } });
        res.redirect("/keys");
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send("Failed to modify key");
    }
});

// Delete key
app.post("/keys/:key/delete", async (req, res) => {
    try {
        const { key } = req.params;
        const token = req.cookies.auth_token;
        await axios.delete(`${API_BASE}/keys/${key}`, { headers: { "x-login-token": token } });
        res.redirect("/keys");
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send("Failed to delete key");
    }
});

// Redeem key
app.post("/redeem", async (req, res) => {
    try {
        const { key, user } = req.body;
        const response = await axios.get(`${API_BASE}/redeem`, { params: { key, user } });
        res.json(response.data);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "Failed to redeem key" });
    }
});

// Export CSV
app.get("/export-csv", async (req, res) => {
    try {
        const token = req.cookies.auth_token;
        const { key, redeemed } = req.query;
        const response = await axios.get(`${API_BASE}/keys-csv`, {
            params: { key, redeemed },
            headers: { "x-login-token": token },
        });
        res.setHeader("Content-Disposition", `attachment; filename=keys.csv`);
        res.setHeader("Content-Type", "text/csv");
        res.send(response.data);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send("Failed to export CSV");
    }
});

// Wipe redeemed keys
app.post("/wipe-redeemed", async (req, res) => {
    try {
        const { type } = req.body;
        const response = await axios.delete(`${API_BASE}/keys-wipe-redeemed`, { params: { type } });
        res.json(response.data);
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "Failed to wipe redeemed keys" });
    }
});

// Logout
app.get("/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.redirect("/");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Frontend running on port ${PORT}`));
