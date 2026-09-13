import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "development-only-change-this-secret";
const dbName = process.env.DB_NAME || "studymate";
const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10
};
let pool;

async function initializeDatabase() {
  const admin = await mysql.createConnection({ ...dbConfig, database: undefined });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await admin.end();
  pool = mysql.createPool(dbConfig);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS planner_profiles (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      profile_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_planner_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
}

app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.userId = jwt.verify(token, jwtSecret).sub;
    next();
  } catch {
    res.status(401).json({ error: "Please sign in to continue." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !email || password.length < 8) {
    return res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );
    const user = { id: result.insertId, name, email };
    res.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That email is already registered." });
    console.error(error);
    res.status(500).json({ error: "Unable to create your account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const [rows] = await pool.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ token: issueToken(user), user: publicUser(user) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const [rows] = await pool.execute("SELECT id, name, email FROM users WHERE id = ?", [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: "Account no longer exists." });
  res.json({ user: rows[0] });
});

app.get("/api/planner", requireAuth, async (req, res) => {
  const [rows] = await pool.execute("SELECT profile_json FROM planner_profiles WHERE user_id = ?", [req.userId]);
  res.json({ profile: rows[0]?.profile_json || null });
});

app.put("/api/planner", requireAuth, async (req, res) => {
  const profile = req.body;
  if (!profile || !Array.isArray(profile.subjects) || typeof profile.routine !== "object") {
    return res.status(400).json({ error: "Planner data is invalid." });
  }
  await pool.execute(
    `INSERT INTO planner_profiles (user_id, profile_json) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json)`,
    [req.userId, JSON.stringify(profile)]
  );
  res.json({ saved: true });
});

app.use((req, res) => res.sendFile(path.join(__dirname, "index.html")));

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`StudyMate running at http://localhost:${port}`)))
  .catch(error => {
    console.error("Could not initialize MySQL:", error.message);
    process.exit(1);
  });
