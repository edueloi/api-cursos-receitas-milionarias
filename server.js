// Editar curso
app.put('/cursos/:id', (req, res) => {
  const { id } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  if (!data.cursos) return res.status(404).json({ error: 'Nenhum curso cadastrado.' });
  const idx = data.cursos.findIndex(c => c.id == id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });
  // Atualiza apenas os campos enviados
  data.cursos[idx] = { ...data.cursos[idx], ...req.body };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Curso atualizado!', curso: data.cursos[idx] });
});

// Deletar curso
app.delete('/cursos/:id', (req, res) => {
  const { id } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  if (!data.cursos) return res.status(404).json({ error: 'Nenhum curso cadastrado.' });
  const idx = data.cursos.findIndex(c => c.id == id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });
  // Remove arquivos do curso (imagem, vídeos, materiais)
  const curso = data.cursos[idx];
  if (curso.imagemCapa) {
    const imgPath = path.join(VIDEOS_DIR, curso.imagemCapa);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  if (curso.materiais) {
    curso.materiais.forEach(mat => {
      const matPath = path.join(MATERIALS_DIR, mat.filename);
      if (fs.existsSync(matPath)) fs.unlinkSync(matPath);
    });
  }
  if (curso.modulos) {
    curso.modulos.forEach(mod => {
      if (mod.conteudos) {
        mod.conteudos.forEach(cont => {
          if (cont.video && cont.video.filename) {
            const vidPath = path.join(VIDEOS_DIR, cont.video.filename);
            if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
          }
          if (cont.materiais) {
            cont.materiais.forEach(mat => {
              const matPath = path.join(MATERIALS_DIR, mat.filename);
              if (fs.existsSync(matPath)) fs.unlinkSync(matPath);
            });
          }
        });
      }
    });
  }
  data.cursos.splice(idx, 1);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Curso deletado!' });
});

// Editar módulo de um curso
app.put('/cursos/:cursoId/modulos/:moduloIdx', (req, res) => {
  const { cursoId, moduloIdx } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  const curso = data.cursos.find(c => c.id == cursoId);
  if (!curso) return res.status(404).json({ error: 'Curso não encontrado.' });
  if (!curso.modulos || !curso.modulos[moduloIdx]) return res.status(404).json({ error: 'Módulo não encontrado.' });
  curso.modulos[moduloIdx] = { ...curso.modulos[moduloIdx], ...req.body };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Módulo atualizado!', modulo: curso.modulos[moduloIdx] });
});

// Deletar módulo de um curso
app.delete('/cursos/:cursoId/modulos/:moduloIdx', (req, res) => {
  const { cursoId, moduloIdx } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  const curso = data.cursos.find(c => c.id == cursoId);
  if (!curso) return res.status(404).json({ error: 'Curso não encontrado.' });
  if (!curso.modulos || !curso.modulos[moduloIdx]) return res.status(404).json({ error: 'Módulo não encontrado.' });
  // Remove arquivos do módulo
  const modulo = curso.modulos[moduloIdx];
  if (modulo.conteudos) {
    modulo.conteudos.forEach(cont => {
      if (cont.video && cont.video.filename) {
        const vidPath = path.join(VIDEOS_DIR, cont.video.filename);
        if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
      }
      if (cont.materiais) {
        cont.materiais.forEach(mat => {
          const matPath = path.join(MATERIALS_DIR, mat.filename);
          if (fs.existsSync(matPath)) fs.unlinkSync(matPath);
        });
      }
    });
  }
  curso.modulos.splice(moduloIdx, 1);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Módulo deletado!' });
});

// Editar conteúdo de um módulo
app.put('/cursos/:cursoId/modulos/:moduloIdx/conteudos/:conteudoIdx', (req, res) => {
  const { cursoId, moduloIdx, conteudoIdx } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  const curso = data.cursos.find(c => c.id == cursoId);
  if (!curso) return res.status(404).json({ error: 'Curso não encontrado.' });
  const modulo = curso.modulos && curso.modulos[moduloIdx];
  if (!modulo) return res.status(404).json({ error: 'Módulo não encontrado.' });
  if (!modulo.conteudos || !modulo.conteudos[conteudoIdx]) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  modulo.conteudos[conteudoIdx] = { ...modulo.conteudos[conteudoIdx], ...req.body };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Conteúdo atualizado!', conteudo: modulo.conteudos[conteudoIdx] });
});

// Deletar conteúdo de um módulo
app.delete('/cursos/:cursoId/modulos/:moduloIdx/conteudos/:conteudoIdx', (req, res) => {
  const { cursoId, moduloIdx, conteudoIdx } = req.params;
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ error: 'Arquivo de dados não encontrado.' });
  let data = JSON.parse(fs.readFileSync(DATA_FILE));
  const curso = data.cursos.find(c => c.id == cursoId);
  if (!curso) return res.status(404).json({ error: 'Curso não encontrado.' });
  const modulo = curso.modulos && curso.modulos[moduloIdx];
  if (!modulo) return res.status(404).json({ error: 'Módulo não encontrado.' });
  if (!modulo.conteudos || !modulo.conteudos[conteudoIdx]) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  // Remove arquivos do conteúdo
  const conteudo = modulo.conteudos[conteudoIdx];
  if (conteudo.video && conteudo.video.filename) {
    const vidPath = path.join(VIDEOS_DIR, conteudo.video.filename);
    if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
  }
  if (conteudo.materiais) {
    conteudo.materiais.forEach(mat => {
      const matPath = path.join(MATERIALS_DIR, mat.filename);
      if (fs.existsSync(matPath)) fs.unlinkSync(matPath);
    });
  }
  modulo.conteudos.splice(conteudoIdx, 1);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: 'Conteúdo deletado!' });
});
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;

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
