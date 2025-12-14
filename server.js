/**
 * =========================================
 * RECEITAS MILIONÁRIAS - CURSOS API
 * Backend Express + Multer + File Storage
 * =========================================
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

/* =========================================
 * APP
 * ========================================= */
const app = express();
const PORT = process.env.PORT || 3030;

/* =========================================
 * MIDDLEWARES
 * ========================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================
 * PATHS & STORAGE
 * ========================================= */
const BASE_DIR = __dirname;
const VIDEOS_DIR = path.join(BASE_DIR, 'videos');
const MATERIALS_DIR = path.join(BASE_DIR, 'materiais');
const DATA_FILE = path.join(BASE_DIR, 'data.json');

if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR);
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ cursos: [] }, null, 2));

/* =========================================
 * MULTER CONFIG
 * ========================================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'materiais') return cb(null, MATERIALS_DIR);
    return cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 } // 300MB
});

/* =========================================
 * HELPERS
 * ========================================= */
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

/* =========================================
 * HEALTH CHECK
 * ========================================= */
app.get('/', (req, res) => {
  res.json({ name: 'Receitas API', status: 'ok' });
});

/* =========================================
 * CURSOS - CREATE
 * ========================================= */
app.post(
  '/upload-curso',
  upload.fields([
    { name: 'imagemCapa', maxCount: 1 },
    { name: 'materiais', maxCount: 20 },
    { name: 'videos', maxCount: 20 }
  ]),
  (req, res) => {
    try {
      const {
        id,
        email,
        codigo_afiliado_proprio,
        titulo,
        descricao,
        categoria,
        nivel,
        preco,
        rascunho,
        modulos
      } = req.body;

      const modulosParsed = JSON.parse(modulos || '[]');

      const curso = {
        id: id || `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        email,
        codigo_afiliado_proprio,
        titulo,
        descricao,
        categoria,
        nivel,
        preco,
        rascunho: rascunho === 'true' || rascunho === true,
        imagemCapa: req.files?.imagemCapa?.[0]?.filename || null,
        materiais: req.files?.materiais
          ? req.files.materiais.map(m => ({ filename: m.filename, originalname: m.originalname }))
          : [],
        modulos: modulosParsed,
        dataCadastro: new Date().toISOString()
      };

      const data = readData();
      data.cursos.push(curso);
      writeData(data);

      res.json({ message: 'Curso salvo com sucesso!', curso });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar curso' });
    }
  }
);

/* =========================================
 * CURSOS - READ
 * ========================================= */
app.get('/cursos', (req, res) => {
  const data = readData();
  res.json({ cursos: data.cursos || [] });
});

/* =========================================
 * CURSOS - UPDATE
 * ========================================= */
app.put('/cursos/:id', (req, res) => {
  const data = readData();
  const idx = data.cursos.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });

  data.cursos[idx] = { ...data.cursos[idx], ...req.body };
  writeData(data);

  res.json({ message: 'Curso atualizado!', curso: data.cursos[idx] });
});

/* =========================================
 * CURSOS - DELETE (COM LIMPEZA)
 * ========================================= */
app.delete('/cursos/:id', (req, res) => {
  const data = readData();
  const idx = data.cursos.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });

  const curso = data.cursos[idx];

  if (curso.imagemCapa) {
    const img = path.join(VIDEOS_DIR, curso.imagemCapa);
    if (fs.existsSync(img)) fs.unlinkSync(img);
  }

  curso.materiais?.forEach(m => {
    const mat = path.join(MATERIALS_DIR, m.filename);
    if (fs.existsSync(mat)) fs.unlinkSync(mat);
  });

  curso.modulos?.forEach(mod =>
    mod.conteudos?.forEach(cont => {
      if (cont.video?.filename) {
        const vid = path.join(VIDEOS_DIR, cont.video.filename);
        if (fs.existsSync(vid)) fs.unlinkSync(vid);
      }
    })
  );

  data.cursos.splice(idx, 1);
  writeData(data);

  res.json({ message: 'Curso deletado!' });
});

/* =========================================
 * DOWNLOADS
 * ========================================= */
app.get('/videos/:filename', (req, res) => {
  const file = path.join(VIDEOS_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Vídeo não encontrado.' });
  res.download(file);
});

app.get('/materiais/:filename', (req, res) => {
  const file = path.join(MATERIALS_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  res.download(file);
});

/* =========================================
 * START SERVER
 * ========================================= */
app.listen(PORT, () => {
  console.log(`🚀 Cursos API rodando na porta ${PORT}`);
});
