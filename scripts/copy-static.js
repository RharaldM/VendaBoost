import fs from 'fs-extra';
import path from 'path';

// Copia arquivos estáticos do public para o dist
async function copyStaticFiles() {
  try {
    const publicDir = path.resolve('public');
    const distDir = path.resolve('dist');
    const srcDir = path.resolve('src');
    
    // Garante que o diretório dist existe
    await fs.ensureDir(distDir);
    
    // Copia manifest.json
    await fs.copy(
      path.join(publicDir, 'manifest.json'),
      path.join(distDir, 'manifest.json')
    );
    
    // Copia icons
    await fs.copy(
      path.join(publicDir, 'icons'),
      path.join(distDir, 'icons')
    );
    
    // Não precisamos mais copiar os módulos do Firebase, pois estamos usando o pacote npm
    console.log('✅ Usando módulos do Firebase do pacote npm');
    
    // Copia auth-styles.css para o dist
    const authStylesSrc = path.join(srcDir, 'auth-styles.css');
    const authStylesDest = path.join(distDir, 'auth-styles.css');
    if (await fs.pathExists(authStylesSrc)) {
      await fs.copy(authStylesSrc, authStylesDest);
      console.log('✅ auth-styles.css copiado');
    }
    
    // Move popup.html do src/ para a raiz do dist/
    const popupHtmlSrc = path.join(distDir, 'src', 'popup.html');
    const popupHtmlDest = path.join(distDir, 'popup.html');
    
    if (await fs.pathExists(popupHtmlSrc)) {
      await fs.move(popupHtmlSrc, popupHtmlDest);
      
      // Remove a pasta src/ vazia se existir
      const srcDir = path.join(distDir, 'src');
      if (await fs.pathExists(srcDir)) {
        const isEmpty = (await fs.readdir(srcDir)).length === 0;
        if (isEmpty) {
          await fs.remove(srcDir);
        }
      }
    }
    
    console.log('✅ Arquivos estáticos copiados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao copiar arquivos estáticos:', error);
    process.exit(1);
  }
}

copyStaticFiles();
