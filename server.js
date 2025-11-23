require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve static frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Proxy API requests to your backend for token-based auth
app.use("/api", async (req, res) => {
  try {
    const url = `https://tradeskey-backend.onrender.com${req.path}`;
    const options = {
      method: req.method,
      headers: { ...req.headers },
      body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
    };
    const response = await fetch(url, options);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Backend request failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
