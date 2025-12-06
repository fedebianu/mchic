import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const PORT = process.env.PORT || 4000;
const ALLOWED_VOICES = ["lucio", "cristiano"];
const ALLOWED_INSTRUMENTS = ["chitarra", "basso"];
const NODE_ENV = process.env.NODE_ENV;
const BASIC_USER = process.env.MCHIC_USER;
const BASIC_PASS = process.env.MCHIC_PASS;
const DATABASE_URL = NODE_ENV === "prod" ? process.env.DB_URL_PROD : process.env.DB_URL_DEV;

if (!BASIC_USER || !BASIC_PASS) {
  throw new Error("MCHIC_USER e MCHIC_PASS devono essere impostate");
}

if (!DATABASE_URL) {
  throw new Error(
    NODE_ENV === "dev"
      ? "Imposta DB_URL_DEV per collegarsi al Postgres di sviluppo"
      : "Imposta DB_URL_PROD per collegarsi al Postgres di produzione"
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "dev" ? false : { rejectUnauthorized: false },
});

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
    const { rows } = await pool.query(
      `select id, author, title, voices, instruments, key_offset
         from songs
        order by lower(author), lower(title);`
    );
    res.json(rows.map(mapSongRow));
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

    const id = randomUUID();
    const { rows } = await pool.query(
      `insert into songs (id, author, title, voices, instruments, key_offset)
       values ($1, $2, $3, $4, $5, $6)
       returning *;`,
      [id, payload.author, payload.title, payload.voices, payload.instruments, payload.keyOffset]
    );
    res.status(201).json(mapSongRow(rows[0]));
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
    const { rows } = await pool.query(
      `update songs
          set author = $1,
              title = $2,
              voices = $3,
              instruments = $4,
              key_offset = $5
        where id = $6
        returning *;`,
      [payload.author, payload.title, payload.voices, payload.instruments, payload.keyOffset, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Brano non trovato." });
    }
    res.json(mapSongRow(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/songs/:id", async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`delete from songs where id = $1;`, [req.params.id]);
    if (!rowCount) {
      return res.status(404).json({ message: "Brano non trovato." });
    }
    res.status(204).end();
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

app.listen(PORT, () => {
  console.log(`Server pronto su http://localhost:${PORT}`);
});

function mapSongRow(row = {}) {
  return {
    id: row.id,
    author: row.author,
    title: row.title,
    voices: row.voices || [],
    instruments: row.instruments || [],
    keyOffset: Number(row.key_offset) || 0,
  };
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
