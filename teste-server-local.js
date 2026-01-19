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

// =========================================
// CORS (produção + dev)
// =========================================
const allowedOrigins = new Set([
  'https://cursos.receitasmilionarias.com.br',
  'http://localhost:3000'
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* =========================================
 * PATHS & STORAGE
 * ========================================= */
const BASE_DIR = __dirname;
const VIDEOS_DIR = path.join(BASE_DIR, 'videos');
const MATERIALS_DIR = path.join(BASE_DIR, 'materiais');
const DATA_FILE = path.join(BASE_DIR, 'data.json');

if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR);
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR);
const DEFAULT_CATEGORIES = [
  'Vendas',
  'Marketing',
  'Gatronomia',
  'Financas',
  'Churrasco',
  'Fitness',
  'Vegano',
  'Doces & Sobremesas',
  'Salgados'
];

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ cursos: [], usuarios: {}, categorias: DEFAULT_CATEGORIES }, null, 2));
}

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
const readData = () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  if (!data.cursos) data.cursos = [];
  if (!data.usuarios) data.usuarios = {};
  if (!data.categorias || data.categorias.length === 0) data.categorias = DEFAULT_CATEGORIES;
  return data;
};
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
        instrutorNome,
        codigo_afiliado_proprio,
        titulo,
        descricao,
        categoria,
        nivel,
        preco,
        rascunho,
        modulos
      } = req.body;

      if (!email || !titulo) {
        return res.status(400).json({ error: 'Email e titulo sao obrigatorios.' });
      }

      let modulosParsed = [];
      try {
        modulosParsed = JSON.parse(modulos || '[]');
      } catch (parseErr) {
        return res.status(400).json({ error: 'Modulos invalidos.' });
      }
      const videoFileMap = new Map((req.files?.videos || []).map(f => [f.originalname, f.filename]));
      const materialFileMap = new Map((req.files?.materiais || []).map(f => [f.originalname, f.filename]));
      const rawModules = Array.isArray(modulosParsed) ? modulosParsed : [];
      const modulosNormalized = rawModules.map(mod => ({
        ...mod,
        conteudos: (mod.conteudos || []).map(lesson => {
          const originalVideoName = lesson?.video?.filename;
          const video = originalVideoName && videoFileMap.has(originalVideoName)
            ? { ...lesson.video, filename: videoFileMap.get(originalVideoName) }
            : lesson.video;
          const materiais = (lesson.materiais || []).map(mat => {
            const key = mat.originalname || mat.filename;
            if (key && materialFileMap.has(key)) {
              return { ...mat, filename: materialFileMap.get(key) };
            }
            return mat;
          });
          return { ...lesson, video, materiais };
        })
      }));

      const data = readData();
      const existingIndex = id ? data.cursos.findIndex(c => c.id == id) : -1;

      // Se não existir, cria ID novo
      const finalId = (existingIndex !== -1 && id) ? id : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      // Se for edição, reaproveita imagem/materiais antigos caso não mande novos
      const old = existingIndex !== -1 ? data.cursos[existingIndex] : null;
      const removeCover = req.body?.removerImagemCapa === 'true' || req.body?.removerImagemCapa === true;
      const normalizedEmail = String(email || '').toLowerCase().trim();
      const oldEmail = String(old?.email || '').toLowerCase().trim();
      if (existingIndex !== -1 && oldEmail && normalizedEmail && oldEmail !== normalizedEmail) {
        return res.status(403).json({ error: 'Apenas o dono do curso pode editar.' });
      }

      const newImagemCapa = req.files?.imagemCapa?.[0]?.filename ?? null;
      const newMateriais = req.files?.materiais
        ? req.files.materiais.map(m => ({ filename: m.filename, originalname: m.originalname }))
        : null;
      if (existingIndex !== -1 && old?.imagemCapa) {
        if (removeCover || (newImagemCapa && old.imagemCapa !== newImagemCapa)) {
          const img = path.join(VIDEOS_DIR, old.imagemCapa);
          if (fs.existsSync(img)) fs.unlinkSync(img);
        }
      }

      const oldModules = old?.modulos || [];
      modulosNormalized.forEach((mod, mIdx) => {
        const oldLessons = oldModules[mIdx]?.conteudos || [];
        (mod.conteudos || []).forEach((lesson, lIdx) => {
          const oldVideo = oldLessons[lIdx]?.video?.filename;
          const newVideo = lesson?.video || {};
          if (newVideo.remove) {
            if (oldVideo) {
              const vid = path.join(VIDEOS_DIR, oldVideo);
              if (fs.existsSync(vid)) fs.unlinkSync(vid);
            }
            lesson.video = {};
            return;
          }
          const newFilename = newVideo.filename;
          if (newFilename && oldVideo && oldVideo !== newFilename) {
            const vid = path.join(VIDEOS_DIR, oldVideo);
            if (fs.existsSync(vid)) fs.unlinkSync(vid);
          }
        });
      });

      const categoriaNome = (categoria || '').toString().trim();
      if (categoriaNome) {
        if (!data.categorias.some(c => c.toLowerCase() === categoriaNome.toLowerCase())) {
          data.categorias.push(categoriaNome);
        }
      }

      const curso = {
        ...(old || {}),
        id: finalId,
        email,
        instrutorNome: instrutorNome || old?.instrutorNome || '',
        codigo_afiliado_proprio,
        titulo,
        descricao,
        categoria,
        nivel,
        preco,
        rascunho: rascunho === 'true' || rascunho === true,
        imagemCapa: removeCover ? null : (newImagemCapa !== null ? newImagemCapa : (old?.imagemCapa ?? null)),
        materiais: newMateriais !== null ? newMateriais : (old?.materiais ?? []),
        modulos: modulosNormalized,
        dataCadastro: old?.dataCadastro ?? new Date().toISOString(),
        dataAtualizacao: new Date().toISOString()
      };

      if (existingIndex !== -1) {
        data.cursos[existingIndex] = curso;
        writeData(data);
        return res.json({ message: 'Curso atualizado com sucesso!', curso });
      }

      data.cursos.push(curso);
      writeData(data);
      return res.json({ message: 'Curso criado com sucesso!', curso });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar/atualizar curso' });
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
 * CATEGORIAS
 * ========================================= */
app.get('/categorias', (req, res) => {
  const data = readData();
  res.json({ categorias: data.categorias || [] });
});

app.post('/categorias', (req, res) => {
  const data = readData();
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Nome da categoria obrigatorio.' });
  if (!data.categorias.some(c => c.toLowerCase() === name.toLowerCase())) {
    data.categorias.push(name);
    writeData(data);
  }
  res.json({ categorias: data.categorias });
});

/* =========================================
 * USUARIOS - LISTAS (MEUS CURSOS / FAVORITOS)
 * ========================================= */
app.get('/usuarios/:email/listas', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const userLists = data.usuarios[email] || { meusCursos: [], favoritos: [] };
  res.json(userLists);
});

app.post('/usuarios/:email/meus-cursos', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const { courseId, action } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId obrigatorio.' });

  if (!data.usuarios[email]) data.usuarios[email] = { meusCursos: [], favoritos: [] };
  const list = data.usuarios[email].meusCursos;
  const id = String(courseId);

  if (action === 'remove') {
    data.usuarios[email].meusCursos = list.filter(c => String(c) !== id);
  } else if (!list.includes(id)) {
    list.push(id);
  }

  writeData(data);
  res.json({ meusCursos: data.usuarios[email].meusCursos });
});

app.post('/usuarios/:email/favoritos', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const { courseId, action } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId obrigatorio.' });

  if (!data.usuarios[email]) data.usuarios[email] = { meusCursos: [], favoritos: [] };
  const list = data.usuarios[email].favoritos;
  const id = String(courseId);

  if (action === 'remove') {
    data.usuarios[email].favoritos = list.filter(c => String(c) !== id);
  } else if (!list.includes(id)) {
    list.push(id);
  }

  writeData(data);
  res.json({ favoritos: data.usuarios[email].favoritos });
});

/* =========================================
 * USUARIOS - ASSINATURA
 * ========================================= */
app.get('/usuarios/:email/assinatura', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const assinatura = data.usuarios[email]?.assinatura || null;
  res.json({ assinatura });
});

app.post('/usuarios/:email/assinatura', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const { text, font } = req.body || {};
  const cleanText = (text || '').toString().trim();
  const cleanFont = (font || '').toString().trim();
  if (!cleanText) return res.status(400).json({ error: 'Texto da assinatura obrigatorio.' });
  if (!cleanFont) return res.status(400).json({ error: 'Fonte da assinatura obrigatoria.' });

  if (!data.usuarios[email]) data.usuarios[email] = { meusCursos: [], favoritos: [], progresso: {}, certificados: {} };
  data.usuarios[email].assinatura = { text: cleanText, font: cleanFont, updatedAt: new Date().toISOString() };
  writeData(data);
  res.json({ assinatura: data.usuarios[email].assinatura });
});

/* =========================================
 * USUARIOS - PROGRESSO
 * ========================================= */
app.get('/usuarios/:email/progresso', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const progresso = data.usuarios[email]?.progresso || {};
  res.json({ progresso });
});

app.post('/usuarios/:email/progresso', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const { courseId, lessonId, completed } = req.body || {};
  if (!courseId || !lessonId) return res.status(400).json({ error: 'courseId e lessonId obrigatorios.' });

  if (!data.usuarios[email]) data.usuarios[email] = { meusCursos: [], favoritos: [], progresso: {} };
  if (!data.usuarios[email].progresso) data.usuarios[email].progresso = {};
  const progressEntry = data.usuarios[email].progresso;
  const cId = String(courseId);
  const lId = String(lessonId);
  if (!progressEntry[cId]) progressEntry[cId] = { completadas: [] };

  const list = progressEntry[cId].completadas || [];
  if (completed === false) {
    progressEntry[cId].completadas = list.filter(id => String(id) !== lId);
  } else if (!list.includes(lId)) {
    list.push(lId);
  }

  writeData(data);
  res.json({ progresso: data.usuarios[email].progresso });
});

/* =========================================
 * USUARIOS - CERTIFICADOS
 * ========================================= */
app.get('/usuarios/:email/certificados', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const certificados = data.usuarios[email]?.certificados || {};
  res.json({ certificados });
});

app.post('/usuarios/:email/certificados', (req, res) => {
  const data = readData();
  const email = req.params.email;
  const { courseId, completedAt } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'courseId obrigatorio.' });

  if (!data.usuarios[email]) data.usuarios[email] = { meusCursos: [], favoritos: [], progresso: {}, certificados: {} };
  if (!data.usuarios[email].certificados) data.usuarios[email].certificados = {};

  const id = String(courseId);
  if (!data.usuarios[email].certificados[id]) {
    const code = `RM-${id.slice(-6).toUpperCase()}-${Math.round(Math.random() * 1e6)}`;
    data.usuarios[email].certificados[id] = {
      code,
      completedAt: completedAt || new Date().toISOString()
    };
    writeData(data);
  }

  res.json({ certificados: data.usuarios[email].certificados });
});

app.get('/certificados/:code', (req, res) => {
  const data = readData();
  const code = req.params.code;
  const emails = Object.keys(data.usuarios || {});
  for (const email of emails) {
    const certs = data.usuarios[email]?.certificados || {};
    for (const courseId of Object.keys(certs)) {
      if (certs[courseId]?.code === code) {
        return res.json({
          valido: true,
          certificado: {
            email,
            courseId,
            code: certs[courseId].code,
            completedAt: certs[courseId].completedAt
          }
        });
      }
    }
  }
  res.status(404).json({ valido: false });
});

/* =========================================
 * DASHBOARD - INSTRUTOR
 * ========================================= */
app.get('/instrutor/:email/dashboard', (req, res) => {
  const data = readData();
  const email = String(req.params.email || '').toLowerCase().trim();
  const cursos = (data.cursos || []).filter(c => String(c.email || '').toLowerCase().trim() === email);

  const courseIds = cursos.map(c => String(c.id));
  const studentsSet = new Set();
  let totalViews = 0;
  const lessonViews = new Map();

  Object.entries(data.usuarios || {}).forEach(([userEmail, userData]) => {
    const meusCursos = (userData?.meusCursos || []).map(id => String(id));
    const hasEnrollment = meusCursos.some(id => courseIds.includes(id));
    if (hasEnrollment) studentsSet.add(userEmail);

    const progresso = userData?.progresso || {};
    Object.keys(progresso).forEach(cid => {
      if (!courseIds.includes(String(cid))) return;
      const completadas = (progresso[cid]?.completadas || []).map(id => String(id));
      totalViews += completadas.length;
      completadas.forEach(lessonId => {
        lessonViews.set(lessonId, (lessonViews.get(lessonId) || 0) + 1);
      });
    });
  });

  let totalQuestions = 0;
  cursos.forEach(c => {
    totalQuestions += (c.perguntas || []).length;
  });

  const topLessons = Array.from(lessonViews.entries())
    .map(([lessonId, views]) => {
      let lessonTitle = '';
      let courseTitle = '';
      let courseId = '';
      for (const course of cursos) {
        const modulos = course.modulos || [];
        for (let mIdx = 0; mIdx < modulos.length; mIdx += 1) {
          const conteudos = modulos[mIdx]?.conteudos || [];
          for (let lIdx = 0; lIdx < conteudos.length; lIdx += 1) {
            const expectedId = `les-${mIdx}-${lIdx}`;
            if (expectedId === lessonId) {
              lessonTitle = conteudos[lIdx]?.tituloAula || '';
              courseTitle = course.titulo || '';
              courseId = String(course.id);
              break;
            }
          }
          if (lessonTitle) break;
        }
        if (lessonTitle) break;
      }
      return { lessonId, lessonTitle, courseTitle, courseId, views };
    })
    .filter(item => item.lessonTitle)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  res.json({
    totalCourses: cursos.length,
    totalStudents: studentsSet.size,
    totalViews,
    totalQuestions,
    topLessons
  });
});

/* =========================================
 * CURSOS - UPDATE
 * ========================================= */
app.put('/cursos/:id', (req, res) => {
  const data = readData();
  const idx = data.cursos.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });

  const requestEmail = String(req.body?.email || '').toLowerCase().trim();
  const ownerEmail = String(data.cursos[idx]?.email || '').toLowerCase().trim();
  if (!requestEmail) {
    return res.status(400).json({ error: 'Email obrigatorio para atualizar curso.' });
  }
  if (ownerEmail && ownerEmail !== requestEmail) {
    return res.status(403).json({ error: 'Apenas o dono do curso pode editar.' });
  }

  data.cursos[idx] = { ...data.cursos[idx], ...req.body };
  writeData(data);

  res.json({ message: 'Curso atualizado!', curso: data.cursos[idx] });
});

/* =========================================
 * CURSOS - PERGUNTAS
 * ========================================= */
app.get('/cursos/:id/perguntas', (req, res) => {
  const data = readData();
  const curso = data.cursos.find(c => c.id == req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso nao encontrado.' });
  res.json({ perguntas: curso.perguntas || [] });
});

app.post('/cursos/:id/perguntas', (req, res) => {
  const data = readData();
  const curso = data.cursos.find(c => c.id == req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso nao encontrado.' });
  const { autorEmail, autorNome, texto } = req.body || {};
  if (!autorEmail || !autorNome || !texto) {
    return res.status(400).json({ error: 'autorEmail, autorNome e texto obrigatorios.' });
  }
  const pergunta = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    autorEmail,
    autorNome,
    texto,
    createdAt: new Date().toISOString(),
    respostas: []
  };
  curso.perguntas = curso.perguntas || [];
  curso.perguntas.push(pergunta);
  writeData(data);
  res.json({ pergunta });
});

app.put('/cursos/:id/perguntas/:pid', (req, res) => {
  const data = readData();
  const curso = data.cursos.find(c => c.id == req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso nao encontrado.' });
  const pergunta = (curso.perguntas || []).find(p => p.id == req.params.pid);
  if (!pergunta) return res.status(404).json({ error: 'Pergunta nao encontrada.' });
  const { texto } = req.body || {};
  if (!texto) return res.status(400).json({ error: 'texto obrigatorio.' });
  pergunta.texto = texto;
  pergunta.updatedAt = new Date().toISOString();
  writeData(data);
  res.json({ pergunta });
});

app.delete('/cursos/:id/perguntas/:pid', (req, res) => {
  const data = readData();
  const curso = data.cursos.find(c => c.id == req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso nao encontrado.' });
  curso.perguntas = (curso.perguntas || []).filter(p => p.id != req.params.pid);
  writeData(data);
  res.json({ message: 'Pergunta removida.' });
});

app.post('/cursos/:id/perguntas/:pid/respostas', (req, res) => {
  const data = readData();
  const curso = data.cursos.find(c => c.id == req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso nao encontrado.' });
  const pergunta = (curso.perguntas || []).find(p => p.id == req.params.pid);
  if (!pergunta) return res.status(404).json({ error: 'Pergunta nao encontrada.' });
  const { autorEmail, autorNome, texto } = req.body || {};
  if (!autorEmail || !autorNome || !texto) {
    return res.status(400).json({ error: 'autorEmail, autorNome e texto obrigatorios.' });
  }
  const resposta = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    autorEmail,
    autorNome,
    texto,
    createdAt: new Date().toISOString()
  };
  pergunta.respostas = pergunta.respostas || [];
  pergunta.respostas.push(resposta);
  writeData(data);
  res.json({ resposta });
});

/* =========================================
 * CURSOS - DELETE (COM LIMPEZA)
 * ========================================= */
app.delete('/cursos/:id', (req, res) => {
  const data = readData();
  const idx = data.cursos.findIndex(c => c.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });

  const requestEmail = String(req.query?.email || '').toLowerCase().trim();
  const ownerEmail = String(data.cursos[idx]?.email || '').toLowerCase().trim();
  if (!requestEmail) {
    return res.status(400).json({ error: 'Email obrigatorio para excluir curso.' });
  }
  if (ownerEmail && ownerEmail !== requestEmail) {
    return res.status(403).json({ error: 'Apenas o dono do curso pode excluir.' });
  }

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
  if (data.usuarios) {
    Object.keys(data.usuarios).forEach(email => {
      const lists = data.usuarios[email];
      if (lists?.meusCursos) {
        lists.meusCursos = lists.meusCursos.filter(cid => String(cid) !== String(req.params.id));
      }
      if (lists?.favoritos) {
        lists.favoritos = lists.favoritos.filter(cid => String(cid) !== String(req.params.id));
      }
      if (lists?.progresso) {
        delete lists.progresso[String(req.params.id)];
      }
      if (lists?.certificados) {
        delete lists.certificados[String(req.params.id)];
      }
    });
  }
  writeData(data);

  res.json({ message: 'Curso deletado!' });
});

/* =========================================
 * DOWNLOADS
 * ========================================= */
app.get('/videos/:filename', (req, res) => {
  const file = path.join(VIDEOS_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Vídeo não encontrado.' });

  const range = req.headers.range;
  const stat = fs.statSync(file);
  const fileSize = stat.size;

  if (!range) {
    return res.sendFile(file);
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  if (start >= fileSize || end >= fileSize) {
    res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    return;
  }

  const chunkSize = (end - start) + 1;
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': 'video/mp4'
  });

  fs.createReadStream(file, { start, end }).pipe(res);
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
