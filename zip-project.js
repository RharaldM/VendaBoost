import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFile = `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.zip`;
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(`✅ Arquivo criado: ${outputFile}`);
  console.log(`📦 Tamanho total: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

output.on('end', function() {
  console.log('Data has been drained');
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ Aviso:', err.message);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

console.log('🚀 Iniciando criação do arquivo ZIP...\n');

// Adicionar todas as pastas exceto as excluídas
const excludedFolders = ['node_modules', 'screen-recorder', '.claude', '.user-profiles', '.git'];
const allItems = fs.readdirSync(__dirname);

allItems.forEach(item => {
  const itemPath = path.join(__dirname, item);
  const stats = fs.statSync(itemPath);
  
  if (stats.isDirectory()) {
    // Verificar se a pasta não está na lista de exclusão
    if (!excludedFolders.includes(item)) {
      archive.directory(itemPath, item);
      console.log(`📁 Adicionando pasta: ${item}`);
    } else {
      console.log(`⏭️  Pulando pasta excluída: ${item}`);
    }
  } else if (stats.isFile()) {
    // Adicionar todos os arquivos no diretório raiz
    // Exceto arquivos de backup anteriores e este próprio script
    if (!item.startsWith('backup-') && !item.endsWith('.zip') && item !== 'zip-project.js' && item !== 'backup.bat') {
      archive.file(itemPath, { name: item });
      console.log(`📄 Adicionando arquivo: ${item}`);
    }
  }
});

console.log('\n⏳ Finalizando arquivo ZIP...');
archive.finalize();