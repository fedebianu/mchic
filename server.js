import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 4000;
const ALLOWED_VOICES = ["lucio", "cristiano"];
const ALLOWED_INSTRUMENTS = ["chitarra", "basso"];
const NODE_ENV = process.env.NODE_ENV || "development";
const BASIC_USER = process.env.MCHIC_USER || (NODE_ENV === "development" ? "mchic" : null);
const BASIC_PASS = process.env.MCHIC_PASS || (NODE_ENV === "development" ? "mammachoilcanto" : null);

if (!BASIC_USER || !BASIC_PASS) {
  throw new Error("MCHIC_USER e MCHIC_PASS devono essere impostate in produzione.");
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, "db");
const DB_PATH = path.join(DB_DIR, "songs.json");
const SEED_PATH = path.join(__dirname, "seed", "songs.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.post("/api/login", (req, res) => {
  const { user, pass } = req.body ?? {};
  if (areValidCredentials(user, pass)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ message: "Credenziali errate." });
});

app.use("/api", basicAuthGate);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/songs", async (req, res, next) => {
  try {
    const songs = await readSongs();
    res.json(songs);
  } catch (error) {
    next(error);
  }
});

app.post("/api/songs", async (req, res, next) => {
  try {
    const payload = buildSongPayload(req.body);
    if ("error" in payload) {
      return res.status(400).json({ message: payload.error });
    }

    const songs = await readSongs();
    const newSong = { id: randomUUID(), ...payload };

    songs.push(newSong);
    await writeSongs(songs);
    res.status(201).json(newSong);
  } catch (error) {
    next(error);
  }
});

app.put("/api/songs/:id", async (req, res, next) => {
  try {
    const payload = buildSongPayload(req.body);
    if ("error" in payload) {
      return res.status(400).json({ message: payload.error });
    }

    const songs = await readSongs();
    const index = songs.findIndex((song) => song.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ message: "Brano non trovato." });
    }

    const updatedSong = { ...songs[index], ...payload };
    songs[index] = updatedSong;
    await writeSongs(songs);
    res.json(updatedSong);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/songs/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const songs = await readSongs();
    const index = songs.findIndex((song) => song.id === id);
    if (index === -1) {
      return res.status(404).json({ message: "Brano non trovato." });
    }
    songs.splice(index, 1);
    await writeSongs(songs);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/reset", async (req, res, next) => {
  try {
    const seeds = await resetFromSeeds();
    res.json({ ok: true, count: seeds.length });
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Errore API:", err);
  res.status(500).json({ message: "Errore interno al server." });
});

await ensureDbFile();
app.listen(PORT, () => {
  console.log(`Server pronto su http://localhost:${PORT}`);
});

async function ensureDbFile() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await resetFromSeeds();
  }
}

async function readSongs() {
  const data = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(data);
}

async function writeSongs(songs) {
  await fs.mkdir(DB_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(songs, null, 2), "utf-8");
}

async function resetFromSeeds() {
  const seeds = await readSeeds();
  await writeSongs(seeds);
  return seeds;
}

async function readSeeds() {
  const data = await fs.readFile(SEED_PATH, "utf-8");
  return JSON.parse(data);
}

function buildSongPayload(body = {}) {
  const title = body?.title?.trim();
  if (!title) {
    return { error: "Il titolo è obbligatorio." };
  }

  const author = body?.author?.trim();
  if (!author) {
    return { error: "L'autore è obbligatorio." };
  }

  const voices = sanitizeVoices(body?.voices);
  if (!voices.length) {
    return {
      error: `Seleziona almeno una voce valida (${ALLOWED_VOICES.join(", ")}).`,
    };
  }

  const instruments = sanitizeInstruments(body?.instruments);
  if (!instruments.length) {
    return { error: "Gli strumenti devono includere almeno una chitarra valida." };
  }

  const keyOffset = normalizeKeyOffset(body?.keyOffset);
  return { title, author, voices, instruments, keyOffset };
}

function sanitizeVoices(value) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = [];
  const seen = new Set();
  items.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }
    const clean = item.trim().toLowerCase();
    if (ALLOWED_VOICES.includes(clean) && !seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
    }
  });
  return normalized;
}

function sanitizeInstruments(value) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = [];
  items.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }
    const clean = item.trim().toLowerCase();
    if (ALLOWED_INSTRUMENTS.includes(clean)) {
      normalized.push(clean);
    }
  });

  if (!normalized.includes("chitarra")) {
    normalized.unshift("chitarra");
  }

  return normalized;
}

function normalizeKeyOffset(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function basicAuthGate(req, res, next) {
  if (req.path === "/api/health") {
    return next();
  }
  const header = req.headers.authorization || "";
  if (isAuthorizedHeader(header)) {
    return next();
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="Mchic"');
  return res.status(401).json({ message: "Accesso non autorizzato." });
}

function isAuthorizedHeader(header) {
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [user, pass] = decoded.split(":");
    return areValidCredentials(user, pass);
  }
  return false;
}

function areValidCredentials(user, pass) {
  return user === BASIC_USER && pass === BASIC_PASS;
}
