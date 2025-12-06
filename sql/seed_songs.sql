BEGIN;

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  voices TEXT[] NOT NULL,
  instruments TEXT[] NOT NULL,
  key_offset NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO songs (id, author, title, voices, instruments, key_offset) VALUES
  ('scaletta-01', 'Gianluca Grignani', 'La mia storia tra le dita', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-02', 'Riccardo Cocciante', 'A mano a mano', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-03', 'Rino Gaetano', 'Aida', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-04', 'Ennio Morricone, Maurizio Costanzo, Ghigo De Chiara', 'Se telefonando', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-05', 'Adriano Celentano', 'L''emozione non ha voce', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-06', 'Marco Masini', 'Bella stronza', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-07', 'Luciano Ligabue', 'Certe notti', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-08', '883 (Max Pezzali)', 'Gli anni', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-09', 'Pino Daniele', 'Dubbi non ho', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-10', 'Pino Daniele', 'Je so pazz', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-11', 'Alex Britti', 'Oggi sono io', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-12', 'Da definire', 'Volevo essere un duro', ARRAY['cristiano'], ARRAY['chitarra','chitarra'], 0),
  ('scaletta-13', 'Da definire', 'Balorda nostalgia', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-14', 'Biagio Antonacci', 'Sognami / Non vivo più', ARRAY['cristiano'], ARRAY['chitarra'], 0),
  ('scaletta-15', 'Mannarino', 'Me so mbriacato', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-16', 'Jovanotti', 'Gli immortali', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-17', 'Da definire', 'Bennato', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-18', 'Da definire', 'Britti', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-19', 'Alex Baroni', 'Cambiare', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-20', 'Enrico Cannio, Aniello Califano', 'O surdat nnamurat', ARRAY['cristiano'], ARRAY['chitarra','chitarra'], 0),
  ('scaletta-21', 'Luca Barbarossa', 'Bella davvero', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-22', 'Da definire', 'Marlena', ARRAY['lucio','cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-23', 'Tiromancino', 'Per due come noi', ARRAY['cristiano'], ARRAY['chitarra','basso'], -3),
  ('scaletta-24', 'Tananai', 'Tango', ARRAY['lucio'], ARRAY['chitarra','basso'], -0.5),
  ('scaletta-25', 'Pino Daniele', 'Yes I know my way', ARRAY['lucio','cristiano'], ARRAY['chitarra','chitarra'], 0),
  ('scaletta-26', 'Da definire', '3 minuti', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-27', 'Negramaro', 'L''immenso', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-28', 'Da definire', 'Un passo indietro', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-29', 'Da definire', 'Amandoti (settembre)', ARRAY['lucio'], ARRAY['chitarra','chitarra'], 0),
  ('scaletta-30', 'Da definire', 'La felicità', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-31', 'Marco Mengoni', 'Hola', ARRAY['lucio','cristiano'], ARRAY['chitarra','basso'], -2),
  ('scaletta-32', 'Gio Evan', 'Gio Evans - Susy', ARRAY['lucio'], ARRAY['chitarra'], 0),
  ('scaletta-33', 'Eros Ramazzotti', 'Amor', ARRAY['cristiano'], ARRAY['chitarra','basso'], -0.5),
  ('scaletta-34', 'Da definire', 'Per sempre', ARRAY['lucio'], ARRAY['chitarra','basso'], 0),
  ('scaletta-35', 'Tiziano Ferro', 'Rossetto e caffè', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0),
  ('scaletta-36', 'Da definire', 'Depresso fortunato', ARRAY['lucio'], ARRAY['chitarra','chitarra'], 0),
  ('scaletta-37', 'Da definire', 'Bottiglie vuote', ARRAY['cristiano'], ARRAY['chitarra','basso'], 0)
ON CONFLICT (id) DO UPDATE SET
  author = EXCLUDED.author,
  title = EXCLUDED.title,
  voices = EXCLUDED.voices,
  instruments = EXCLUDED.instruments,
  key_offset = EXCLUDED.key_offset;

COMMIT;

