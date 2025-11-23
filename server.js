require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Proxy API requests to tradeskey-backend
const BACKEND_URL = "https://tradeskey-backend.onrender.com";

app.use("/api", async (req, res) => {
  try {
    const url = `${BACKEND_URL}${req.path}`;
    const method = req.method.toLowerCase();
    const headers = { ...req.headers };

    // Forward HttpOnly token cookie
    if (req.cookies?.auth_token) headers["x-login-token"] = req.cookies.auth_token;

    const axiosConfig = {
      method,
      url,
      headers,
      data: req.body,
      params: req.query,
    };

    const response = await axios(axiosConfig);
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      console.error(err);
      res.status(500).json({ error: "Server proxy error" });
    }
  }
});

// Fallback to frontend for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));
