const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const VIDEOS_DIR = path.join(__dirname, 'videos');
const DATA_FILE = path.join(VIDEOS_DIR, 'data.json');
const MATERIALS_DIR = path.join(__dirname, 'materiais');
if (!fs.existsSync(MATERIALS_DIR)) fs.mkdirSync(MATERIALS_DIR);

// Configuração do multer para upload de vídeos, imagens e materiais
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, VIDEOS_DIR);
    } else if (file.fieldname === 'imagemCapa') {
      cb(null, VIDEOS_DIR);
    } else if (file.fieldname === 'materiais') {
      cb(null, MATERIALS_DIR);
    } else {
      cb(null, VIDEOS_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Middleware para JSON
app.use(express.json());


// Rota para upload de curso completo (com módulos, conteúdos, vídeos, imagem de capa, materiais)
app.post('/upload-curso', upload.fields([
  { name: 'imagemCapa', maxCount: 1 },
  { name: 'materiais', maxCount: 20 },
  { name: 'videos', maxCount: 20 }
]), (req, res) => {
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
    modulos // JSON string
  } = req.body;

  // Parse modulos (deve ser enviado como JSON.stringify([...]))
  let modulosParsed = [];
  try {
    modulosParsed = JSON.parse(modulos || '[]');
  } catch (e) {
    return res.status(400).json({ error: 'Formato de módulos inválido.' });
  }

  // Processar arquivos
  const imagemCapa = req.files['imagemCapa'] ? req.files['imagemCapa'][0].filename : null;
  const materiais = req.files['materiais'] ? req.files['materiais'].map(f => ({ filename: f.filename, originalname: f.originalname })) : [];
  // Os vídeos podem ser enviados como parte dos conteúdos dos módulos
  // O frontend deve associar o nome do arquivo ao conteúdo correto

  // Montar objeto do curso
  const curso = {
    id: id || (Date.now() + '-' + Math.round(Math.random() * 1E9)),
    email,
    codigo_afiliado_proprio,
    titulo,
    descricao,
    categoria,
    nivel,
    preco,
    rascunho: rascunho === 'true' || rascunho === true,
    imagemCapa,
    materiais,
    modulos: modulosParsed,
    dataCadastro: new Date().toISOString()
  };

  // Salvar no arquivo
  let data = { cursos: [] };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  }
  if (!data.cursos) data.cursos = [];
  data.cursos.push(curso);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Curso salvo com sucesso!', curso });
});


// Rota para listar cursos
app.get('/cursos', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ cursos: [] });
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json({ cursos: data.cursos || [] });
});


// Rota para baixar vídeo
app.get('/videos/:id', (req, res) => {
  const { id } = req.params;
  const filePath = path.join(VIDEOS_DIR, id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Vídeo não encontrado.' });
  }
  res.download(filePath);
});

// Rota para baixar material complementar
app.get('/materiais/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(MATERIALS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
  res.download(filePath);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
