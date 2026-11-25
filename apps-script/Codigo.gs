/**
 * Fotos de Expedição — backend (Google Apps Script)
 *
 * Guarda as fotos numa pasta do Google Drive e o índice de pedidos numa
 * Planilha Google. A página no GitHub Pages conversa com este script.
 *
 * Passo a passo no README.md.
 */

// >>> TROQUE pela senha que a equipe vai digitar na página (mínimo 8 caracteres).
const SENHA = 'TROQUE-ESTA-SENHA';

const FUSO = 'America/Sao_Paulo';
const NOME_PASTA = 'Fotos de Expedição';
const NOME_PLANILHA = 'Fotos de Expedição - Índice';
const ABA = 'Fotos';
const ABA_MINI = 'Miniaturas';
const COLS = ['id', 'tirada', 'dia', 'pedido', 'nf', 'chave', 'loja', 'produto', 'operador', 'obs', 'criadoEm', 'arquivoId', 'hash', 'editado'];
const C = {};
COLS.forEach(function (nome, i) { C[nome] = i; });
const LIMITE_LISTA = 3000;
const LIMITE_BUSCA = 500;

/* ---------- Entradas ---------- */

function doGet() {
  return json_({ ok: true, servico: 'Fotos de Expedição' });
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (!SENHA || SENHA === 'TROQUE-ESTA-SENHA' || SENHA.length < 8) {
      return erro_('Defina a SENHA no script (mínimo 8 caracteres) e publique de novo.');
    }
    if (d.senha !== SENHA) return erro_('Senha inválida.');

    switch (d.acao) {
      case 'ping': return ping_();
      case 'listar': return listar_(d);
      case 'buscar': return buscar_(d);
      case 'miniaturas': return miniaturas_(d);
      case 'foto': return foto_(d);
      case 'enviar': return comTrava_(function () { return enviar_(d); });
      case 'editar': return comTrava_(function () { return editar_(d); });
      default: return erro_('Ação desconhecida.');
    }
  } catch (err) {
    return erro_('Falha no servidor: ' + err.message);
  }
}

/** Rode uma vez no editor (Executar > configurar) para criar a pasta e a planilha e autorizar o acesso. */
function configurar() {
  var ss = planilha_();
  Logger.log('Pasta das fotos: ' + pasta_().getUrl());
  Logger.log('Planilha de índice: ' + ss.getUrl());
}

/* ---------- Ações ---------- */

function ping_() {
  var sh = planilha_().getSheetByName(ABA);
  return json_({ ok: true, total: Math.max(0, sh.getLastRow() - 1) });
}

function listar_(d) {
  var de = String(d.de || '0000-00-00');
  var ate = String(d.ate || '9999-99-99');
  var linhas = lerLinhas_();
  var saida = [];
  for (var i = 0; i < linhas.length; i++) {
    var dia = linhas[i][C.dia];
    if (dia >= de && dia <= ate) saida.push(objeto_(linhas[i], i + 2));
  }
  saida.sort(porTiradaDesc_);
  var cortou = saida.length > LIMITE_LISTA;
  return json_({ ok: true, linhas: saida.slice(0, LIMITE_LISTA), cortou: cortou });
}

function buscar_(d) {
  var termos = normalizar_(d.q).split(/\s+/).filter(function (t) { return t; });
  if (!termos.length) return json_({ ok: true, linhas: [], cortou: false });
  var linhas = lerLinhas_();
  var saida = [];
  for (var i = 0; i < linhas.length; i++) {
    var v = linhas[i];
    var dia = String(v[C.dia]).split('-');
    var texto = normalizar_([
      v[C.pedido], v[C.nf], v[C.chave], v[C.loja], v[C.produto], v[C.operador], v[C.obs],
      dia[2] + '/' + dia[1] + '/' + dia[0]
    ].join(' '));
    var todos = true;
    for (var t = 0; t < termos.length; t++) {
      if (texto.indexOf(termos[t]) === -1) { todos = false; break; }
    }
    if (todos) saida.push(objeto_(v, i + 2));
  }
  saida.sort(porTiradaDesc_);
  return json_({ ok: true, linhas: saida.slice(0, LIMITE_BUSCA), cortou: saida.length > LIMITE_BUSCA });
}

function miniaturas_(d) {
  var linhas = (d.linhas || []).slice(0, 40).map(Number).filter(function (n) { return n >= 2; });
  var mapa = {};
  if (linhas.length) {
    var mh = planilha_().getSheetByName(ABA_MINI);
    var refs = linhas.map(function (n) { return 'B' + n; });
    var ranges = mh.getRangeList(refs).getRanges();
    for (var i = 0; i < ranges.length; i++) mapa[linhas[i]] = String(ranges[i].getValue() || '');
  }
  return json_({ ok: true, miniaturas: mapa });
}

function foto_(d) {
  var sh = planilha_().getSheetByName(ABA);
  var linha = Number(d.linha);
  var v = sh.getRange(linha, 1, 1, COLS.length).getValues()[0];
  if (v[C.id] !== d.id) return erro_('Registro não encontrado.');
  var arq = DriveApp.getFileById(v[C.arquivoId]);
  return json_({ ok: true, foto: Utilities.base64Encode(arq.getBlob().getBytes()), nome: arq.getName() });
}

function enviar_(d) {
  var pedido = limpo_(d.pedido);
  if (!pedido) return erro_('Informe o número do pedido.');
  var tirada = String(d.tirada || '');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(tirada)) return erro_('Data e hora da foto inválidas.');
  if (!d.foto) return erro_('Foto não recebida.');

  var ss = planilha_();
  var sh = ss.getSheetByName(ABA);
  var mh = ss.getSheetByName(ABA_MINI);
  var n = sh.getLastRow();

  if (d.hash && n > 1) {
    var hashes = sh.getRange(2, C.hash + 1, n - 1, 1).getValues();
    for (var i = 0; i < hashes.length; i++) {
      if (hashes[i][0] === d.hash) return json_({ ok: true, duplicado: true, linha: i + 2 });
    }
  }

  var dia = tirada.slice(0, 10);
  var mes = tirada.slice(0, 7);
  var nome = tirada.replace(/[: ]/g, '-') + '_' + pedido.replace(/[^A-Za-z0-9_-]/g, '') + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(d.foto), 'image/jpeg', nome);
  var arquivo = subpasta_(mes).createFile(blob);

  var id = Utilities.getUuid();
  var linha = n + 1;
  var registro = [];
  registro[C.id] = id;
  registro[C.tirada] = tirada.length === 16 ? tirada + ':00' : tirada;
  registro[C.dia] = dia;
  registro[C.pedido] = pedido;
  registro[C.nf] = limpo_(d.nf);
  registro[C.chave] = limpo_(d.chave);
  registro[C.loja] = limpo_(d.loja);
  registro[C.produto] = limpo_(d.produto);
  registro[C.operador] = limpo_(d.operador);
  registro[C.obs] = limpo_(d.obs);
  registro[C.criadoEm] = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH:mm:ss');
  registro[C.arquivoId] = arquivo.getId();
  registro[C.hash] = limpo_(d.hash);
  registro[C.editado] = '';

  var faixa = sh.getRange(linha, 1, 1, COLS.length);
  faixa.setNumberFormat('@');
  faixa.setValues([registro]);

  var mini = String(d.mini || '');
  var celula = mh.getRange(linha, 1, 1, 2);
  celula.setNumberFormat('@');
  celula.setValues([[id, mini.length < 49000 ? mini : '']]);

  return json_({ ok: true, id: id, linha: linha });
}

function editar_(d) {
  var sh = planilha_().getSheetByName(ABA);
  var linha = Number(d.linha);
  if (!(linha >= 2)) return erro_('Registro não encontrado.');
  var v = sh.getRange(linha, 1, 1, COLS.length).getValues()[0];
  if (v[C.id] !== d.id) return erro_('Registro não encontrado.');
  var pedido = limpo_(d.pedido);
  if (!pedido) return erro_('Informe o número do pedido.');

  v[C.pedido] = pedido;
  v[C.nf] = limpo_(d.nf);
  v[C.chave] = limpo_(d.chave);
  v[C.loja] = limpo_(d.loja);
  v[C.produto] = limpo_(d.produto);
  v[C.obs] = limpo_(d.obs);
  var quando = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH:mm:ss');
  v[C.editado] = quando + (d.operador ? ' por ' + limpo_(d.operador) : '');

  var faixa = sh.getRange(linha, 1, 1, COLS.length);
  faixa.setNumberFormat('@');
  faixa.setValues([v]);
  return json_({ ok: true, linha: objeto_(v, linha) });
}

/* ---------- Drive e Planilha ---------- */

function pasta_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PASTA_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recria abaixo */ }
  }
  var pasta = DriveApp.createFolder(NOME_PASTA);
  props.setProperty('PASTA_ID', pasta.getId());
  return pasta;
}

function subpasta_(mes) {
  var props = PropertiesService.getScriptProperties();
  var chave = 'SUB_' + mes;
  var id = props.getProperty(chave);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recria abaixo */ }
  }
  var sub = pasta_().createFolder(mes);
  props.setProperty(chave, sub.getId());
  return sub;
}

function planilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PLANILHA_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* recria abaixo */ }
  }
  var ss = SpreadsheetApp.create(NOME_PLANILHA);
  var fotos = ss.getSheets()[0];
  fotos.setName(ABA);
  fotos.getRange(1, 1, 1, COLS.length).setNumberFormat('@').setValues([COLS]).setFontWeight('bold');
  fotos.setFrozenRows(1);
  var mini = ss.insertSheet(ABA_MINI);
  mini.getRange(1, 1, 1, 2).setNumberFormat('@').setValues([['id', 'miniatura']]).setFontWeight('bold');
  mini.setFrozenRows(1);
  DriveApp.getFileById(ss.getId()).moveTo(pasta_());
  props.setProperty('PLANILHA_ID', ss.getId());
  return ss;
}

/* ---------- Utilitários ---------- */

function lerLinhas_() {
  var sh = planilha_().getSheetByName(ABA);
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, COLS.length).getValues();
}

function objeto_(v, linha) {
  return {
    linha: linha,
    id: v[C.id],
    tirada: String(v[C.tirada]),
    dia: String(v[C.dia]),
    pedido: String(v[C.pedido]),
    nf: String(v[C.nf]),
    chave: String(v[C.chave]),
    loja: String(v[C.loja]),
    produto: String(v[C.produto]),
    operador: String(v[C.operador]),
    obs: String(v[C.obs]),
    criadoEm: String(v[C.criadoEm]),
    editado: String(v[C.editado])
  };
}

function porTiradaDesc_(a, b) {
  return a.tirada < b.tirada ? 1 : a.tirada > b.tirada ? -1 : 0;
}

function limpo_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 300);
}

function normalizar_(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function comTrava_(fn) {
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try { return fn(); } finally { trava.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erro_(mensagem) {
  return json_({ ok: false, erro: mensagem });
}
