// Declarações globais no topo do arquivo
// Removido import para evitar erro de módulos ES6 no content script

// Robust avatar URL validator for 2025
function isRealAvatar(url) {
  if (!url) return false;
  url = url.toLowerCase();

  // Block clear invalids/placeholders
  const invalidPatterns = [
    'transparent', 'placeholder', 'default', 'blank', 'empty',
    'group-avatar-icons', 'fbcdn.net/rsrc.php', '.svg', '.gif?cid=',
    '/p40x40/', '/c0.0.', 'data:image/gif;base64,r0lgodlhaqab', 'data:image/svg+xml'
  ];
  if (invalidPatterns.some(pattern => url.includes(pattern))) {
    console.log('[Avatar Debug] Rejected as invalid/placeholder:', url);
    return false;
  }

  // Accept new CDN/image types (including AVIF, etc)
  const validPatterns = [
    /^https:\/\/(scontent|platform-lookaside|avtrcdn|cdninstagram)\..*\.(jpg|jpeg|png|webp|avif)/,
    /^data:image\/(jpeg|png|webp|avif);base64,/
  ];
  if (validPatterns.some(rx => rx.test(url))) {
    console.log('[Avatar Debug] Accepted as real avatar:', url);
    return true;
  }

  console.log('[Avatar Debug] Uncertain URL - rejected:', url);
  return false;
}

// Universal image source getter (handles lazy loading & srcset)
function getImgUrl(img) {
  if (!img) return '';
  return (
    img.src ||
    img.getAttribute('data-src') ||
    (img.getAttribute('srcset') ? img.getAttribute('srcset').split(' ')[0] : '') ||
    img.getAttribute('data-img-src') ||
    ''
  );
}

// Enhanced avatar extraction function for Facebook groups (2025+)
function findImage(node) {
  if (!node) {
    console.log('[Avatar Debug] findImage called with null/undefined node');
    return '';
  }

  console.log('[Avatar Debug] findImage started on node:', {
    tag: node.tagName,
    classes: node.className?.substring(0, 50) || 'none',
    id: node.id || 'none',
    visible: node.offsetParent !== null
  });

  // Strategy definitions
  const strategies = [
    // 1. Direct <img> with likely FB avatar classes or alt
    {
      name: 'Direct img with FB classes/alt',
      fn: (targetNode = node) => {
        const selectors = [
          'img[class*="x1rg5ohu"]',
          'img[class*="xt0psk2"]',
          'img[class*="x5yr21d"]',
          'img[class*="xh8yej3"]',
          'img[alt*="group"]',
          'img[alt*="perfil"]'
        ];
        for (const sel of selectors) {
          const img = targetNode.querySelector(sel);
          if (img) {
            let src = getImgUrl(img);
            if (src && isRealAvatar(src)) {
              console.log(`[Avatar Debug] Found via ${this && this.name || 'Direct img'} selector ${sel}:`, src);
              return src;
            }
          }
        }
        return null;
      }
    },

    // 2. Any <img> with CDN src (includes most direct CDN images)
    {
      name: 'Any img with CDN src',
      fn: (targetNode = node) => {
        const img = targetNode.querySelector('img[src^="https://scontent"], img[data-src^="https://scontent"]');
        if (img) {
          let src = getImgUrl(img);
          if (src && isRealAvatar(src)) {
            console.log(`[Avatar Debug] Found via Any img with CDN src:`, src);
            return src;
          }
        }
        return null;
      }
    },

    // 3. Background-image on divs (very common for new FB)
    {
      name: 'Background image',
      fn: (targetNode = node) => {
        const bg = targetNode.querySelector('[style*="background-image"], div[class*="x1rg5ohu"][style*="background"]');
        if (bg && bg.style.backgroundImage) {
          const urlMatch = bg.style.backgroundImage.match(/url\("?(.*?)"?\)/);
          const url = urlMatch ? urlMatch[1] : '';
          if (url && isRealAvatar(url)) {
            console.log(`[Avatar Debug] Found via Background image:`, url);
            return url;
          }
        }
        return null;
      }
    },

    // 4. SVG <image>
    {
      name: 'SVG image',
      fn: (targetNode = node) => {
        const svgImage = targetNode.querySelector('svg image');
        if (svgImage) {
          let src =
            svgImage.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
            svgImage.getAttribute('xlink:href') ||
            svgImage.getAttribute('href') ||
            '';
          if (src && isRealAvatar(src)) {
            console.log(`[Avatar Debug] Found via SVG image:`, src);
            return src;
          }
        }
        return null;
      }
    },

    // 5. All SVGs fallback
    {
      name: 'All SVGs fallback',
      fn: (targetNode = node) => {
        const svgs = targetNode.querySelectorAll('svg');
        for (let svg of svgs) {
          const imgs = svg.querySelectorAll('image');
          for (let im of imgs) {
            let src =
              im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
              im.getAttribute('xlink:href') ||
              im.getAttribute('href');
            if (src && isRealAvatar(src)) {
              console.log(`[Avatar Debug] Found via All SVGs fallback:`, src);
              return src;
            }
          }
        }
        return null;
      }
    },

    // 6. Canvas data URL (rare fallback)
    {
      name: 'Canvas fallback',
      fn: (targetNode = node) => {
        const canvas = targetNode.querySelector('canvas');
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL();
            if (dataUrl && isRealAvatar(dataUrl)) {
              console.log(`[Avatar Debug] Found via Canvas fallback (canvas export):`, dataUrl.substring(0, 50));
              return dataUrl;
            }
          } catch (e) {
            console.log(`[Avatar Debug] Canvas access error:`, e.message);
          }
        }
        return null;
      }
    },

    // 7. All imgs fallback (generic, last-resort)
    {
      name: 'All imgs fallback',
      fn: (targetNode = node) => {
        const allImgs = targetNode.querySelectorAll('img');
        for (const img of allImgs) {
          let src = getImgUrl(img);
          if (src) console.log('[Avatar Debug] Found image (fallback):', src);
          if (src && isRealAvatar(src)) {
            console.log('[Avatar Debug] Fallback succeeded:', src);
            return src;
          }
        }
        return null;
      }
    }
  ];

  // Execute all strategies on the node ONLY (no parent traversal to avoid picking shared images)
  for (const strat of strategies) {
    const result = strat.fn(node);
    if (result) return result;
    console.log(`[Avatar Debug] Strategy "${strat.name}" returned null`);
  }

  // REMOVED: Parent traversal that was causing all groups to pick the same image
  // REMOVED: Sibling check that could pick wrong images from other group cards

  console.log('[Avatar Debug] No avatar found after all attempts');
  console.log('[Avatar Debug] Node outerHTML sample:', node.outerHTML.substring(0, 300) + '...');
  return '';
}

// Função principal de detecção de grupos do Facebook
async function detectarGruposFacebook() {
    console.log('🔍 Iniciando detecção de grupos do Facebook...');
    
    // Função para aguardar elementos aparecerem na página
    function aguardarElemento(seletor, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const verificar = () => {
                const elemento = document.querySelector(seletor);
                if (elemento) {
                    resolve(elemento);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout ao aguardar elemento: ${seletor}`));
                } else {
                    setTimeout(verificar, 100);
                }
            };
            
            verificar();
        });
    }
    
    // Função para rolar a página até o final
    async function rolarAteOFinal() {
        let alturaAnterior = 0;
        let alturaAtual = document.documentElement.scrollHeight;
        let tentativas = 0;
        const maxTentativas = 50;
        
        while (alturaAnterior !== alturaAtual && tentativas < maxTentativas) {
            alturaAnterior = alturaAtual;
            window.scrollTo(0, document.documentElement.scrollHeight);
            
            // Aguarda o carregamento de novos grupos
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            alturaAtual = document.documentElement.scrollHeight;
            tentativas++;
            
            console.log(`📜 Rolando página... (Tentativa ${tentativas}/${maxTentativas})`);
        }
        
        console.log('✅ Rolagem completa!');
    }
    
    // Função principal para detectar grupos
    async function detectarGrupos() {
        const grupos = new Map(); // Usar Map para evitar duplicatas
        
        try {
            // Aguarda a página carregar
            await aguardarElemento('[role="main"]');
            console.log('📄 Página carregada!');
            
            // Rola até o final para carregar todos os grupos
            await rolarAteOFinal();
            
            // Seletores possíveis para grupos (mais específicos)
            const seletores = [
                // Seletores específicos para grupos
                'div[role="article"] a[href*="/groups/"]:not([href*="Ver"]):not([href*="discover"])',
                'div[data-pagelet*="GroupsTab"] a[href*="/groups/"]',
                'div[aria-label*="Groups"] a[href*="/groups/"]',
                'a[href*="/groups/"][role="link"]:not([aria-label*="Ver"]):not([aria-label*="Descobrir"])',
                // Seletores mais gerais
                'a[href^="/groups/"]:not([href*="joins"]):not([href*="discover"])',
                'div[role="main"] a[href*="facebook.com/groups/"]'
            ];
            
            // Tenta cada seletor
            for (const seletor of seletores) {
                const elementos = document.querySelectorAll(seletor);
                console.log(`🔍 Testando seletor: ${seletor} - Encontrados: ${elementos.length}`);
                
                elementos.forEach((elemento, index) => {
                    const href = elemento.href || elemento.getAttribute('href');
                    
                    // Filtra apenas links válidos de grupos
                    if (href && href.includes('/groups/') && !href.includes('/groups/joins/')) {
                        // Extrai o ID ou nome do grupo
                        const match = href.match(/\/groups\/([^\/\?]+)/);
                        if (match) {
                            const grupoId = match[1];
                            console.log(`[Group Debug] Processing group ${index + 1}: ID=${grupoId}`);
                            console.log(`[Group Debug] Group element:`, {
                                tag: elemento.tagName,
                                classes: elemento.className?.substring(0, 50) || 'none',
                                href: href.substring(0, 100)
                            });
                            
                            // Função para extrair nome do grupo
                            function extrairNomeGrupo(elemento) {
                                // Textos inválidos que devem ser ignorados
                                const textosInvalidos = [
                                    'Ver grupo', 'ver grupo', 'VER GRUPO',
                                    'Descobrir', 'descobrir', 'DESCOBRIR', 
                                    'Seu feed', 'seu feed', 'SEU FEED',
                                    'Feed', 'feed', 'FEED',
                                    'Grupos', 'grupos', 'GRUPOS',
                                    'Mais', 'mais', 'MAIS',
                                    'Classificar', 'classificar', 'CLASSIFICAR'
                                ];
                                
                                // Estratégias para encontrar o nome do grupo
                                const estrategias = [
                                    // 1. Texto direto do elemento (se não for inválido)
                                    () => {
                                        const texto = elemento.textContent.trim();
                                        if (texto && !textosInvalidos.includes(texto)) {
                                            return texto;
                                        }
                                        return null;
                                    },
                                    
                                    // 2. Aria-label do elemento
                                    () => {
                                        const ariaLabel = elemento.getAttribute('aria-label');
                                        if (ariaLabel && !textosInvalidos.includes(ariaLabel)) {
                                            return ariaLabel;
                                        }
                                        return null;
                                    },
                                    
                                    // 3. Title do elemento
                                    () => {
                                        const title = elemento.title || elemento.getAttribute('title');
                                        if (title && !textosInvalidos.includes(title)) {
                                            return title;
                                        }
                                        return null;
                                    },
                                    
                                    // 4. Procura em elementos pai por h3, strong, ou span
                                    () => {
                                        const parent = elemento.closest('div[role="article"]') || 
                                                     elemento.closest('div[data-pagelet]') ||
                                                     elemento.closest('div[class*="group"]') ||
                                                     elemento.parentElement;
                                        
                                        if (parent) {
                                            const seletoresTexto = [
                                                'h3', 'h2', 'h4',
                                                'strong',
                                                'span[dir="auto"]',
                                                'div[role="heading"]',
                                                'a[role="link"]:not([href*="Ver"])',
                                                '[data-testid*="group-name"]'
                                            ];
                                            
                                            for (const seletor of seletoresTexto) {
                                                const textoElemento = parent.querySelector(seletor);
                                                if (textoElemento) {
                                                    const texto = textoElemento.textContent.trim();
                                                    if (texto && !textosInvalidos.includes(texto) && texto.length > 2) {
                                                        return texto;
                                                    }
                                                }
                                            }
                                        }
                                        return null;
                                    },
                                    
                                    // 5. Procura por texto em elementos irmãos
                                    () => {
                                        const siblings = elemento.parentElement?.children || [];
                                        for (const sibling of siblings) {
                                            if (sibling !== elemento) {
                                                const texto = sibling.textContent.trim();
                                                if (texto && !textosInvalidos.includes(texto) && texto.length > 2) {
                                                    return texto;
                                                }
                                            }
                                        }
                                        return null;
                                    }
                                ];
                                
                                // Tenta cada estratégia
                                for (const estrategia of estrategias) {
                                    try {
                                        const nome = estrategia();
                                        if (nome) {
                                            return nome;
                                        }
                                    } catch (e) {
                                        continue;
                                    }
                                }
                                
                                return null;
                            }
                            
                            // Extrai nome usando a função melhorada
                            const nomeGrupo = extrairNomeGrupo(elemento);
                            
                            // Updated avatar extraction with isolated container processing
                            function extrairAvatarGrupo(elemento) {
                                console.log('[Avatar Debug] Starting extrairAvatarGrupo for element:', {
                                    tag: elemento.tagName,
                                    classes: elemento.className?.substring(0, 100) || 'none',
                                    href: elemento.href || 'no href'
                                });

                                const containerStrategies = [
                                    // 1. Find the closest article/listitem container (most isolated)
                                    () => elemento.closest('div[role="article"]') || elemento.closest('li') || elemento.closest('div[role="listitem"]'),
                                    // 2. Find immediate parent that contains an image (limited to 2 levels max)
                                    () => {
                                        let parent = elemento.parentElement;
                                        let levels = 0;
                                        while (parent && parent !== document.body && levels < 2) {
                                            if (parent.querySelector('img, svg image, [style*="background-image"]')) {
                                                return parent;
                                            }
                                            parent = parent.parentElement;
                                            levels++;
                                        }
                                        return null;
                                    },
                                    // 3. Fallback to immediate parent only
                                    () => elemento.parentElement,
                                    // 4. Last resort: use the link element itself
                                    () => elemento
                                ];

                                let avatar = '';
                                let strategyIndex = 0;

                                for (const getContainer of containerStrategies) {
                                    strategyIndex++;
                                    const container = getContainer();
                                    if (container) {
                                        console.log(`[Avatar Debug] Trying container strategy ${strategyIndex}:`, {
                                            tag: container.tagName,
                                            classes: container.className?.substring(0, 50) || 'none',
                                            childImages: container.querySelectorAll('img, svg image').length
                                        });
                                        avatar = findImage(container);
                                        if (avatar) {
                                            console.log(`[Avatar Debug] SUCCESS! Found avatar with strategy ${strategyIndex}:`, avatar.substring(0, 100));
                                            return avatar;
                                        }
                                    } else {
                                        console.log(`[Avatar Debug] Strategy ${strategyIndex} returned null container`);
                                    }
                                }

                                console.log('[Avatar Debug] No avatar found for this group');
                                return '';
                            }
                            
                            const avatarGrupo = extrairAvatarGrupo(elemento);
                            
                            // Adiciona ao Map se tiver um nome válido
                            if (nomeGrupo && nomeGrupo.length > 2) {
                                grupos.set(grupoId, {
                                    nome: nomeGrupo,
                                    link: href.startsWith('http') ? href : `https://www.facebook.com${href}`,
                                    id: grupoId,
                                    avatar: avatarGrupo,
                                    dataEncontrado: new Date().toISOString()
                                });
                            }
                        }
                    }
                });
            }
            
            // Converte Map para Array
            const listaGrupos = Array.from(grupos.values());
            
            // Exibe resultados
            console.log('\n🎯 GRUPOS ENCONTRADOS:');
            console.log('='.repeat(60));
            
            if (listaGrupos.length > 0) {
                // Prepare data for console.table
                const tableData = listaGrupos.map(grupo => ({
                    name: grupo.nome,
                    id: grupo.id,
                    avatar: grupo.avatar || 'none',
                    link: grupo.link
                }));
                
                console.table(tableData, ['name', 'id', 'avatar', 'link']);
                
                console.log('\n' + '='.repeat(60));
                console.log(`✅ Total de grupos encontrados: ${listaGrupos.length}`);
                const gruposComAvatar = listaGrupos.filter(g => g.avatar).length;
                console.log(`🖼️ Grupos com avatar: ${gruposComAvatar}/${listaGrupos.length}`);
                
                return listaGrupos;
                
            } else {
                console.log('❌ Nenhum grupo foi encontrado.');
                return [];
            }
            
        } catch (erro) {
            console.error('❌ Erro ao detectar grupos:', erro);
            return [];
        }
    }
    
    // Executa a detecção
    return await detectarGrupos();
}

// Encapsulamento de declarações globais para evitar conflitos
if (typeof window.CATEGORY_MAP === 'undefined') {
    // Mapeamento de IDs para nomes de categorias para uso interno no content script.
    // É CRUCIAL que os valores (os nomes) correspondam exatamente ao texto exibido no Facebook Marketplace.
    window.CATEGORY_MAP = {
        "diversos": "Diversos",
        "moveis": "Móveis"
    };
}

if (typeof window.HEADER_CATEGORY_NAMES === 'undefined') {
    // --- NOVA CONSTANTE CRUCIAL ---
    // Nomes de categorias que são apenas títulos visuais (cabeçalhos) e NÃO devem ser clicados.
    // A extensão deve encontrar esses elementos, mas pular a ação de clique, prosseguindo para o próximo item da cadeia na mesma lista.
    window.HEADER_CATEGORY_NAMES = [];
    // --- FIM NOVA CONSTANTE CRUCIAL ---
}

if (typeof window.OPTION_TEXT_TRANSLATIONS === 'undefined') {
    // Mapeamento de traduções para textos de opções que podem aparecer de forma diferente na interface
    window.OPTION_TEXT_TRANSLATIONS = {
        // Adicione aqui traduções conforme necessário
        // Exemplo: "texto_interno": "Texto que aparece na interface"
    };
    // --- FIM MAPEAMENTO DE TRADUÇÕES ---
}

if (typeof window.campos === 'undefined') {
    // Declaração global de campos para formulário do Facebook Marketplace
    window.campos = {
    titulo: [
        'input#_r_3t_',
        'input#_r_1g_',
        'div.x1n2onr6 input[type="text"]',
        'input[aria-label="Título"]',
        'input[placeholder="Título"]',
        'input[placeholder="título"]',
        'input[placeholder*="Título"]',
        'input[placeholder*="título"]',
        'input[aria-label*="Título"]',
        'input[aria-label*="título"]',
        'div[role="main"] input[type="text"]:first-of-type',
        'form input[type="text"]:first-of-type',
        'div[data-pagelet*="marketplace"] input[type="text"]:first-of-type',
        'div[data-pagelet*="create"] input[type="text"]:first-of-type',
        'input[type="text"]:first-of-type',
        'input:not([type]):first-of-type',
        'input[type="text"]',
        'input:not([type])',
        'textarea',
        'div[role="textbox"][aria-label*="título"]',
        'div[role="textbox"][aria-label*="title"]',
        'div[contenteditable="true"][aria-label*="título"]',
        'div[contenteditable="true"][aria-label*="title"]'
    ],
    preco: [
        'input[id="_r_57_"]',
        'input[type="text"][value*="R$"]',
        'input[autocomplete="off"][type="text"]',
        'input[placeholder="Preço"]',
        'input[placeholder="preço"]',
        'input[placeholder*="Preço"]',
        'input[placeholder*="preço"]',
        'input[aria-label*="Preço"]',
        'input[aria-label*="preço"]',
        'input[placeholder*="R$"]',
        'input[aria-label*="R$"]',
        'input[type="number"]',
        'input[inputmode="numeric"]',
        'input[pattern*="[0-9]"]',
        'div[role="main"] input[type="text"]',
        'form input[type="text"]',
        'div[data-pagelet*="marketplace"] input[type="text"]',
        'div[data-pagelet*="create"] input[type="text"]'
    ],
    descricao: [
        'textarea[id="_r_3k_"]', // Seletor direto para o ID fornecido (preferencial)
        'textarea[placeholder="Descrição"]',
        'textarea[placeholder="Description"]',
        'textarea[aria-label="Descrição"]',
        'textarea[aria-label="Description"]',
        'div[aria-label="Descrição"][contenteditable="true"]',
        'div[aria-label="Description"][contenteditable="true"]',
        'div[aria-label="Detalhes"][contenteditable="true"]',
        'div[aria-label="Details"][contenteditable="true"]',
        'textarea[data-testid="marketplace-composer-description-input"]',
        'textarea[data-testid="description-input"]',
        'div[data-testid*="description"]',
        'div[data-pagelet="MarketplaceComposer"] textarea',
        'div[data-pagelet="MarketplaceComposer"] div[contenteditable="true"]',
        'form[method="post"] textarea',
        'div[role="main"] textarea',
        'div[role="main"] div[contenteditable="true"]',
        'textarea[placeholder*="descrição"]',
        'textarea[placeholder*="Descrição"]',
        'textarea[placeholder*="description"]',
        'textarea[placeholder*="Description"]',
        'textarea[placeholder*="detalhes"]',
        'textarea[placeholder*="Detalhes"]',
        'textarea[aria-label*="descrição"]',
        'textarea[aria-label*="Descrição"]',
        'textarea[aria-label*="description"]',
        'textarea[aria-label*="Description"]',
        'textarea[name="description"]',
        'textarea[name="descricao"]',
        'div[contenteditable="true"]',
        'div[role="textbox"]',
        'div[data-testid*="composer-input"]'
    ],
    localizacao: [
        'input[aria-label="Localização"][data-testid="marketplace-composer-location-input"]',
        'input[aria-label="Location"][data-testid="marketplace-composer-location-input"]',
        'input[placeholder="Localização"][data-testid*="location"]',
        'input[placeholder="Location"][data-testid*="location"]',
        'div[role="combobox"][aria-label="Localização"]',
        'div[role="combobox"][aria-label="Location"]',
        'input[aria-label="Localização"]',
        'input[placeholder="Localização"]',
        'input[id*="_r_"][aria-label="Localização"]',
        'input[class*="x1i10hfl"][aria-label="Localização"]',
        'input[role="combobox"][aria-label="Localização"]',
        'input[type="text"][aria-label="Localização"]'
    ],
    categoria: [
        'label[role="combobox"][aria-labelledby*="_r_"]',
        'label[role="combobox"]',
        'div[role="combobox"][aria-label="Categoria"]',
        'div[role="combobox"] div[textContent="Categoria"]',
        'div[role="combobox"] span[textContent="Categoria"]',
        'div[aria-label="Categoria"][role="combobox"]',
        'div[aria-labelledby][textContent*="Categoria"]',
        'div[data-testid*="category"][aria-label="Categoria"]',
        'div[data-testid*="marketplace_category"]',
        'div[role="combobox"] label[textContent="Categoria"]',
        'div[aria-haspopup="listbox"][aria-label="Categoria"]',
        'div[role="combobox"] ~ div[textContent="Categoria"]',
        'div[role="combobox"] > div > label[role="combobox"]'
    ]
    };
}

function debugElementosDisponiveis() {
    console.log('[Content Script] === DEBUG: Elementos disponíveis na página ===');
    
    // Busca mais específica para elementos de categoria
    const elementos = document.querySelectorAll('label[role="combobox"], div[role="combobox"], span[class*="x193iq5w"], div[role="option"], li[role="option"], div[aria-label*="Categoria"], div[aria-label*="Category"], div[class*="x78zum5"], div[aria-haspopup="listbox"]');
    console.log(`[Content Script] Total de elementos encontrados: ${elementos.length}`);
    
    elementos.forEach((el, index) => {
        if (el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0) {
            console.log(`[Content Script] Elemento ${index + 1}:`, {
                tag: el.tagName,
                id: el.id || 'N/A',
                classes: el.className || 'N/A',
                role: el.getAttribute('role') || 'N/A',
                ariaLabelledBy: el.getAttribute('aria-labelledby') || 'N/A',
                ariaLabel: el.getAttribute('aria-label') || 'N/A',
                dataTestid: el.getAttribute('data-testid') || 'N/A',
                textContent: el.textContent.substring(0, 50) || 'N/A',
                outerHTML: el.outerHTML.substring(0, 200)
            });
            
            // Verifica se o elemento tem ancestrais clicáveis
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 3) { // Verifica até 3 níveis acima
                console.log(`[Content Script] Ancestral ${depth + 1} de elemento ${index + 1}: ` +
                          `tag=${parent.tagName}, role=${parent.getAttribute('role')}, ` +
                          `class=${parent.className.substring(0, 50)}`);
                parent = parent.parentElement;
                depth++;
            }
        }
    });
    
    // Também buscar campos de formulário genéricos
    const todosInputs = document.querySelectorAll('input, textarea, div[contenteditable="true"], select');
    console.log(`[Content Script] Total de campos de formulário encontrados: ${todosInputs.length}`);
    
    todosInputs.forEach((elemento, index) => {
        if (elemento.offsetParent !== null && elemento.offsetWidth > 0 && elemento.offsetHeight > 0) {
            console.log(`[Content Script] Campo ${index}:`, {
                tag: elemento.tagName,
                type: elemento.type,
                placeholder: elemento.placeholder,
                ariaLabel: elemento.getAttribute('aria-label'),
                name: elemento.name,
                id: elemento.id,
                className: elemento.className,
                role: elemento.getAttribute('role'),
                outerHTML: elemento.outerHTML.substring(0, 300)
            });
        }
    });

    console.log('[Content Script] === FIM DEBUG ===');
}

// ############ FUNÇÕES DE INTERAÇÃO COM ELEMENTOS ############

// Função auxiliar para encontrar elementos com retentativas
async function encontrarElemento(seletores, maxTentativas = 20, intervaloMs = 500) {
    let tentativa = 0;
    while (tentativa < maxTentativas) {
        for (const seletor of seletores) {
            try {
                const elemento = document.querySelector(seletor);
                // Verifica se o elemento existe, é visível e não está desabilitado
                if (elemento && elemento.offsetParent !== null && elemento.offsetWidth > 0 && elemento.offsetHeight > 0 && !elemento.disabled) {
                    console.log(`[Content Script] Elemento encontrado com seletor: ${seletor}`);
                    return elemento;
                }
            } catch (e) {
                console.warn(`[Content Script] Erro ao tentar seletor '${seletor}': ${e.message}`);
            }
        }
        console.log(`[Content Script] Tentativa ${tentativa + 1}/${maxTentativas}: Elemento não encontrado ou não visível. Aguardando...`);
        await new Promise(resolve => setTimeout(resolve, intervaloMs));
        tentativa++;
    }
    console.error(`[Content Script] Falha ao encontrar elemento após ${maxTentativas} tentativas com seletores:`, seletores);
    return null;
}

// Função generalizada para selecionar uma opção dentro de um combobox/lista
async function selectOptionInCombobox(comboboxElement, optionText) {
    console.log(`[Content Script] DEBUG: Iniciando selectOptionInCombobox para: "${optionText}"`);
    console.log(`[Content Script] DEBUG: Elemento combobox recebido:`, comboboxElement);
    console.log(`[Content Script] Tentando selecionar a opção "${optionText}" no combobox.`);
    if (!comboboxElement) {
        console.error(`[Content Script] Elemento combobox não fornecido para seleção de "${optionText}".`);
        return false;
    }

    // Determine o texto real a ser procurado na interface do Facebook
    let searchText = optionText;
    if (window.OPTION_TEXT_TRANSLATIONS[optionText]) {
        searchText = window.OPTION_TEXT_TRANSLATIONS[optionText];
        console.log(`[Content Script] Traduzindo texto da opção: "${optionText}" -> "${searchText}"`);
    }

    // Clicar no combobox para abrir a lista de opções (código existente)
    comboboxElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    comboboxElement.dispatchEvent(clickEvent);
    comboboxElement.focus();
    await new Promise(resolve => setTimeout(resolve, 1500));

    const commonOptionSelectors = [
        'div[role="option"]', 
        'div[role="button"]', 
        'li[role="option"]',
        'span[role="option"]',
        'a[role="option"]',
        'div[class*="x78zum5"]', 
        'div[class*="x193iq5w"]', 
        'div[class*="x4zkqgt"]', 
        'div[aria-label*="Opção"]', 
    ];

    let optionElement = null;
    let foundOption = false;

    // NOVO: Normaliza o texto de busca apenas uma vez para comparações eficientes
    const normalizedSearchText = searchText.trim().toLowerCase();

    // Arrays para armazenar as correspondências por tipo de precisão
    let exactMatches = [];
    let startsWithMatches = [];
    let includesMatches = []; // Armazena todas as correspondências 'includes' para depuração

    // Tentar encontrar a opção por alguns segundos
    for (let i = 0; i < 20 && !foundOption; i++) { 
        // A cada tentativa, limpa os matches para reavaliar o DOM atual
        exactMatches = [];
        startsWithMatches = [];
        includesMatches = [];

        for (const selector of commonOptionSelectors) {
            const potentialOptions = document.querySelectorAll(selector);
            for (const opt of potentialOptions) {
                if (opt.offsetParent === null || opt.offsetWidth === 0 || opt.offsetHeight === 0) {
                    continue; 
                }

                let checkText = '';
                // Reutilizando sua lógica aprimorada de extração de texto
                let ariaLabel = opt.getAttribute('aria-label');
                let title = opt.getAttribute('title');

                if (ariaLabel && ariaLabel.trim().length > checkText.length) {
                    checkText = ariaLabel.trim();
                }
                if (title && title.trim().length > checkText.length) {
                    checkText = title.trim();
                }
                let textContentSelf = opt.textContent.trim();
                if (textContentSelf.length > checkText.length) {
                    checkText = textContentSelf;
                }
                let nestedElements = opt.querySelectorAll('span, div');
                for (let nestedEl of nestedElements) {
                    let nestedText = nestedEl.textContent.trim();
                    if (nestedText.length > checkText.length) { 
                        checkText = nestedText;
                    }
                    let nestedAriaLabel = nestedEl.getAttribute('aria-label');
                    if (nestedAriaLabel && nestedAriaLabel.trim().length > checkText.length) {
                        checkText = nestedAriaLabel.trim();
                    }
                }
                // Fim da lógica de extração de checkText

                const normalizedCheckText = checkText.trim().toLowerCase();

                // Prioridade de correspondência
                if (normalizedCheckText === normalizedSearchText) {
                    exactMatches.push(opt);
                } else if (normalizedCheckText.startsWith(normalizedSearchText)) {
                    startsWithMatches.push(opt);
                }
                // Sempre adicione a correspondência 'includes' para depuração ou fallback
                else if (normalizedCheckText.includes(normalizedSearchText)) {
                    includesMatches.push(opt);
                }
            }
        }

        // NOVO: Seleciona o melhor match encontrado com prioridade para "Brazil"
        if (exactMatches.length > 0) {
            // Filtra para priorizar opções que contenham "Brazil"
            const brazilMatches = exactMatches.filter(el =>
                el.textContent.toLowerCase().includes("brazil")
            );
            optionElement = brazilMatches.length > 0 ? brazilMatches[0] : exactMatches[0];
            foundOption = true;
            console.log(`[Content Script] DEBUG: Correspondência EXATA para "${searchText}" encontrada! Priorizando "${optionElement.textContent.trim()}"`);
        } else if (startsWithMatches.length > 0) {
            // Filtra e prioriza opções que começam com o texto e contêm "Brazil"
            const brazilStartsWith = startsWithMatches.filter(el =>
                el.textContent.toLowerCase().includes("brazil")
            );
            optionElement = brazilStartsWith.length > 0 ? brazilStartsWith[0] : startsWithMatches[0];
            foundOption = true;
            console.log(`[Content Script] DEBUG: Correspondência "COMEÇA COM" para "${searchText}" encontrada! Priorizando "${optionElement.textContent.trim()}"`);
        } else if (includesMatches.length > 0) {
            // Ordena includesMatches por preferência: menor comprimento e presença de "Brazil"
            includesMatches.sort((a, b) => {
                const aText = a.textContent.toLowerCase();
                const bText = b.textContent.toLowerCase();
                const aHasBrazil = aText.includes("brazil");
                const bHasBrazil = bText.includes("brazil");
                if (aHasBrazil && !bHasBrazil) return -1; // Prioriza "Brazil"
                if (!aHasBrazil && bHasBrazil) return 1;
                return aText.length - bText.length; // Se ambos ou nenhum tiver "Brazil", usa o menor comprimento
            });
            optionElement = includesMatches[0];
            foundOption = true;
            console.log(`[Content Script] DEBUG: Correspondência "INCLUI" para "${searchText}" encontrada! Selecionando "${optionElement.textContent.trim()}"`);
        }

        if (!foundOption) {
            console.log(`[Content Script] Opção "${optionText}" (procurando por "${searchText}") não encontrada ainda. Tentativa ${i+1}. Aguardando...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            break; // Sai do loop de tentativas se encontrou um elemento
        }
    }

    if (!optionElement) {
        console.error(`[Content Script] Opção "${optionText}" (procurando por "${searchText}") NÃO ENCONTRADA após múltiplas tentativas.`);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
    }

    // Clicar na opção encontrada (código existente)
    console.log(`[Content Script] Clicando na opção "${optionElement.textContent.trim()}" (procurada como "${searchText}").`); 
    optionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 300)); 
    const optionClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    optionElement.dispatchEvent(optionClickEvent);
    optionElement.focus();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[Content Script] Opção "${searchText}" selecionada com sucesso.`);
    return true;
}

// NOVA FUNÇÃO principal para selecionar uma cadeia de categorias (ex: Imóveis > Classificados > Diversos)
async function selectCategoryPath(categoryPathIds) {
    // Converte os IDs em nomes de exibição usando o mapa
    const categoryPathNames = categoryPathIds.map(id => window.CATEGORY_MAP[id] || id);
    console.log(`[Content Script] Iniciando seleção da cadeia de categorias: ${categoryPathNames.join(' > ')}`);

    // 1. Encontrar o COMBOBOX da Categoria Principal (o gatilho para abrir a primeira lista)
    const mainCategoryComboboxSelectors = [
        // Seletor específico encontrado pelo usuário
        'label.x78zum5.xh8yej3[role="combobox"][tabindex="0"]',
        // Seletores originais como fallback
        'label[role="combobox"][aria-labelledby*="_r_"]',
        'label[role="combobox"]',
        'div[role="combobox"][aria-label*="categoria"]',
        'div[role="combobox"] span[textContent*="Categoria"]',
        'div[data-testid*="category-selector"]',
        'div[data-testid*="marketplace_category_input"]',
        'input[aria-label="Categoria"]',
        'input[placeholder*="Categoria"]'
    ];
    console.log('[Content Script] Buscando o combobox principal da categoria...');
    const mainCategoryCombobox = await encontrarElemento(mainCategoryComboboxSelectors);
    
    if (!mainCategoryCombobox) {
        console.error('[Content Script] Não foi possível encontrar o combobox da categoria principal.');
        debugElementosDisponiveis(); // Adicionado para depuração
        return false;
    }
    console.log('[Content Script] Combobox principal da categoria encontrado:', mainCategoryCombobox);

    // Clicar no combobox principal para abrir a primeira lista de opções
    console.log(`[Content Script] Clicando no combobox principal para abrir a lista inicial.`);
    mainCategoryCombobox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // --- Início: Tentativas de clique mais robustas ---
    try {
        mainCategoryCombobox.click(); // Tenta o clique nativo primeiro
        console.log('[Content Script] Clique nativo no combobox realizado.');
    } catch (e) {
        console.warn('[Content Script] Erro no clique nativo, tentando simulação de evento:', e);
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        mainCategoryCombobox.dispatchEvent(clickEvent);
        mainCategoryCombobox.focus();
        console.log('[Content Script] Clique simulado no combobox realizado.');
    }
    // --- Fim: Tentativas de clique mais robustas ---
    
    // Dar tempo para a primeira lista de opções carregar
    console.log('[Content Script] Aguardando 2s para a lista de categorias aparecer...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    debugElementosDisponiveis(); // Depurar o que apareceu após o clique

    // Iniciar iteração sobre a cadeia de categorias
    for (let i = 0; i < categoryPathNames.length; i++) {
        const optionTextToSelect = categoryPathNames[i];
        
        // Verifica se o item atual na cadeia é um cabeçalho visual e NÃO deve ser clicado
        const isHeader = window.HEADER_CATEGORY_NAMES.includes(optionTextToSelect);
        
        // Log detalhado para ajudar na depuração
        console.log(`[Content Script] Tentando selecionar item na cadeia (${i + 1}/${categoryPathNames.length}): "${optionTextToSelect}". É cabeçalho? ${isHeader}`);

        let optionElement = null;
        let foundOption = false;

        // Tentar encontrar a opção por alguns segundos dentro da lista *atualmente aberta*
        for (let attempt = 0; attempt < 20 && !foundOption; attempt++) { // Máximo de 10 segundos (20 * 500ms)
            // Reutiliza os seletores aprimorados
            const commonOptionSelectors = [
                // Seletores específicos encontrados para "Diversos"
                'div.xjbqb8w.x1iyjqo2.x193iq5w.xeuugli.x1n2onr6 span.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft',
                'label.x78zum5.xh8yej3[role="combobox"] div.xjbqb8w.x1iyjqo2.x193iq5w.xeuugli.x1n2onr6 span',
                // Seletores originais
                'div[role="option"]', 
                'div[role="button"]', 
                'li[role="option"]',
                'span[role="option"]',
                'a[role="option"]',
                'div[class*="x78zum5"]', 
                'div[class*="x193iq5w"]', 
                'div[class*="x4zkqgt"]', 
                'div[aria-label*="Opção"]', 
            ];
            
            for (const selector of commonOptionSelectors) {
                const potentialOptions = document.querySelectorAll(selector);
                console.log(`[Content Script] Encontrados ${potentialOptions.length} elementos com seletor: ${selector}`);
                
                for (const opt of potentialOptions) {
                    if (opt.textContent && opt.textContent.trim().toLowerCase().includes(optionTextToSelect.trim().toLowerCase())) {
                        if (opt.offsetParent !== null && opt.offsetWidth > 0 && opt.offsetHeight > 0) { // Verificar visibilidade
                            optionElement = opt;
                            foundOption = true;
                            console.log(`[Content Script] Encontrado elemento para "${optionTextToSelect}": `, opt.textContent);
                            console.log(`[Content Script] Detalhes do elemento encontrado:`, {
                                tag: opt.tagName,
                                classes: opt.className,
                                role: opt.getAttribute('role'),
                                outerHTML: opt.outerHTML.substring(0, 200),
                                parentClasses: opt.parentElement ? opt.parentElement.className : 'N/A'
                            });
                            break;
                        }
                    }
                }
                if (foundOption) break;
            }
            if (!foundOption) {
                console.log(`[Content Script] Item "${optionTextToSelect}" não encontrado. Tentativa ${attempt + 1}. Aguardando...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (!optionElement) {
            console.error(`[Content Script] Falha: Item "${optionTextToSelect}" não encontrado após múltiplas tentativas.`);
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            return false;
        }

        if (isHeader) {
            console.log(`[Content Script] *** IGNORANDO CLIQUE ***: Item "${optionTextToSelect}" é um cabeçalho visual. Prosseguindo para o próximo item na mesma lista.`);
            // Se é um cabeçalho, apenas o encontramos. Não clicamos.
            // Pequeno atraso para estabilidade antes da próxima iteração.
            await new Promise(resolve => setTimeout(resolve, 500)); 
        } else {
            // Se não é um cabeçalho, então é uma opção clicável real.
            console.log(`[Content Script] Clicando na opção "${optionTextToSelect}"...`);
            optionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300)); 
            
            // Clique normal para outras opções
            const optionClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            optionElement.dispatchEvent(optionClickEvent);
            optionElement.focus();
            

            // Dar tempo para a UI atualizar / novas sub-opções carregarem após o clique
            if (i < categoryPathNames.length - 1) { // Se não for a última opção da cadeia
                const waitTime = 2000 + Math.random() * 500;
                console.log(`[Content Script] Opção "${optionTextToSelect}" selecionada. Aguardando ${waitTime/1000}s para carregar próximas opções...`);
                await new Promise(resolve => setTimeout(resolve, waitTime)); 
            } else {
                console.log(`[Content Script] Última opção "${optionTextToSelect}" selecionada. Aguardando 1s para UI atualizar.`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    console.log(`[Content Script] Cadeia de categorias selecionada com sucesso: ${categoryPathNames.join(' > ')}`);
    return true;
}


// ############ FIM DAS FUNÇÕES PRINCIPAIS ############

// Verificar se o script já foi injetado para evitar redeclaração
if (window.vendaBoostLoaded) {
    console.log(" Script já carregado, evitando redeclaração");
} else {
    window.vendaBoostLoaded = true;
    
    // Content script
    console.log(" Content script ativo e injetado.");
    console.log(" URL atual:", window.location.href);
    console.log(" Estado do documento:", document.readyState);

    // Verificar se o runtime está disponível
    if (chrome.runtime && chrome.runtime.id) {
        console.log(" Runtime conectado com ID:", chrome.runtime.id);
    } else {
        console.error(" Runtime não disponível!");
    }
    
    // Função para notificar que o content script está pronto
    let tentativasNotificacao = 0;
    const maxTentativasNotificacao = 20;
    let notificacaoEnviada = false;

    function notificarProntidao() {
        if (notificacaoEnviada || !isExtensionContextValid()) return;

        tentativasNotificacao++;
        console.log(`[Content Script] Tentativa ${tentativasNotificacao}/${maxTentativasNotificacao} de notificar prontidão`);

        if (tentativasNotificacao > maxTentativasNotificacao) {
            console.error(" Máximo de tentativas de notificação atingido");
            return;
        }

        try {
            chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(" Erro ao notificar que está pronto:", chrome.runtime.lastError.message);
                    console.log(" Estado atual do documento:", document.readyState);
                    if (tentativasNotificacao < maxTentativasNotificacao) {
                        setTimeout(notificarProntidao, 3000 * tentativasNotificacao);
                    }
                } else {
                    console.log(" Notificação de prontidão enviada com sucesso");
                    notificacaoEnviada = true;
                }
            });
        } catch (error) {
            console.error(" Erro ao enviar notificação de prontidão:", error);
            if (tentativasNotificacao < maxTentativasNotificacao) {
                setTimeout(notificarProntidao, 3000);
            }
        }
    }

    // Função para verificar se o contexto da extensão ainda é válido
    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage;
        } catch (error) {
            return false;
        }
    }

    // Sistema de heartbeat para manter conexão ativa
    let heartbeatInterval = null;

    function iniciarHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        heartbeatInterval = setInterval(() => {
            if (!isExtensionContextValid()) {
                console.log(" Contexto da extensão invalidado durante heartbeat, aguardando recuperação...");
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
                notificacaoEnviada = false;
                tentativasNotificacao = 0;
                setTimeout(() => {
                    if (isExtensionContextValid()) {
                        console.log(" Contexto restaurado, reiniciando notificação...");
                        notificarProntidao();
                        iniciarHeartbeat();
                    }
                }, 5000);
                return;
            }
            if (notificacaoEnviada) {
                try {
                    chrome.runtime.sendMessage({ action: 'heartbeat' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn(" Heartbeat falhou:", chrome.runtime.lastError.message);
                            notificacaoEnviada = false;
                            tentativasNotificacao = 0;
                            setTimeout(notificarProntidao, 3000);
                        } else {
                            console.log(" Heartbeat enviado com sucesso");
                        }
                    });
                } catch (error) {
                    console.warn(" Erro ao enviar heartbeat:", error);
                    notificacaoEnviada = false;
                    tentativasNotificacao = 0;
                    setTimeout(notificarProntidao, 3000);
                }
            }
        }, 30000); // Heartbeat a cada 30 segundos
    }

    // Aguardar que o DOM esteja completamente carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log(" DOM carregado, enviando notificação de prontidão...");
            setTimeout(() => {
                notificarProntidao();
                iniciarHeartbeat();
            }, 1000);
        });
    } else {
        console.log(" DOM já carregado, enviando notificação de prontidão...");
        setTimeout(() => {
            notificarProntidao();
            iniciarHeartbeat();
        }, 1000);
    }

    // Listener para mensagens da extensão (popup, background script)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log(" Mensagem recebida:", request);
        
        if (!isExtensionContextValid()) {
            console.log(" Contexto da extensão invalidado, ignorando mensagem");
            sendResponse({ success: false, error: 'Extension context invalidated' });
            return false;
        }
        
        // Verificação adicional de runtime
        if (!chrome.runtime || !chrome.runtime.id) {
            console.log(" Runtime não disponível");
            sendResponse({ success: false, error: 'Runtime not available' });
            return false;
        }

        if (request.action === "ping") {
            console.log(" Ping recebido, respondendo...");
            sendResponse({ success: true, message: "Content script ativo" });
        } else if (request.action === "startPost") {
            console.log(" Iniciando ação de postagem automática...");

            const button = document.querySelector('button[aria-label="Criar novo anúncio"]');
            if (button) {
                button.click();
                sendResponse({ status: "Postagem iniciada com sucesso!" });
            } else {
                console.warn(" Botão de criar anúncio não encontrado.");
                sendResponse({ status: "Elemento não encontrado." });
            }
        } else if (request.action === "preencherEPublicar") {
            console.log(" Iniciando preenchimento automático do formulário...");
            try {
                preencherEPublicarPost(request.postData, sendResponse);
            } catch (error) {
                console.error(" Erro ao processar preenchimento:", error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        } else if (request.action === "preencherCategoriaCadeia") {
            // Usa a função selectCategoryPath que espera um ARRAY DE IDs
            console.log(" Recebida solicitação para selecionar cadeia de categorias (IDs):");
            console.log(request.categoryPathIds); // Log para ver o array completo
            selectCategoryPath(request.categoryPathIds).then(sucesso => {
                sendResponse({
                    success: sucesso,
                    message: sucesso ? "Cadeia de categorias selecionada com sucesso" : "Falha ao selecionar cadeia de categorias"
                });
            });
            return true;
        } else if (request.action === 'uploadImages') {
            uploadImages(request.images)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    console.error('[Content Script] Erro no upload:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Indica que a resposta será assíncrona
        } else if (request.action === 'debugFileInputs') {
            debugFileInputs();
            sendResponse({ success: true });
        } else if (request.action === 'escanearGrupos') {
            console.log('🚀 Iniciando escaneamento de grupos...');
            
            // Executa o escaneamento
            detectarGruposFacebook()
                .then(grupos => {
                    sendResponse({
                        sucesso: true,
                        grupos: grupos,
                        total: grupos.length
                    });
                })
                .catch(erro => {
                    sendResponse({
                        sucesso: false,
                        erro: erro.message
                    });
                });
            
            return true; // Mantém o canal aberto para resposta assíncrona
        } else {
            console.warn(" Ação desconhecida:", request.action);
            sendResponse({ success: false, error: "Ação não reconhecida" });
        }
    });

    // Função para preencher e publicar post automaticamente
    async function preencherEPublicarPost(postData, sendResponse) {
        console.log(" Iniciando preenchimento do formulário com dados:", postData);
        let responseEnviada = false;
        
        const enviarResposta = (response) => {
            if (!responseEnviada) {
                responseEnviada = true;
                console.log(" Enviando resposta:", response);
                sendResponse(response);
            } else {
                console.warn(" Tentativa de enviar resposta duplicada ignorada");
            }
        };

        try {
            console.log(" Aguardando carregamento da página...");
            await new Promise(resolve => setTimeout(resolve, 8000)); // Aumentado para 8000ms
            
            console.log(" Iniciando preenchimento dos campos...");
            const preenchido = await preencherFormulario(postData);
            
            if (!preenchido) {
                console.error(" Nenhum campo foi preenchido");
                enviarResposta({ success: false, error: "Nenhum campo foi preenchido" });
                return;
            }
            
            // Clica no botão "Avançar" após preencher o formulário
            console.log('[Content Script] Tentando avançar para a próxima etapa...');
            await clicarBotaoAvancar();
            
            // Sistema de detecção automática de grupos removido
            console.log('[Content Script] Detecção automática de grupos desabilitada');
            
            // Sistema de seleção automática de grupos removido
            console.log('[Content Script] Seleção automática de grupos desabilitada');
            
            // Publicação automática ativada
            console.log("🚀 Tentando publicar o post...");
            await new Promise(resolve => setTimeout(resolve, 5000)); // Atraso antes de tentar publicar
            
            const publicado = await clicarBotaoPublicar(postData);
            
            if (publicado) {
                console.log('✅ [Content Script] Post publicado com sucesso!');
                enviarResposta({ success: true, message: 'Post publicado com sucesso!' });
            } else {
                console.error("❌ Falha ao publicar o post");
                console.log("🔧 Para diagnosticar o problema, abra o console e digite: debugPublicacao()");
                
                // Executar debug automaticamente para ajudar no diagnóstico
                setTimeout(() => {
                    try {
                        debugPublicacao();
                    } catch (error) {
                        console.log("Erro ao executar debug:", error);
                    }
                }, 1000);
                
                enviarResposta({ 
                    success: false, 
                    error: 'Não foi possível encontrar ou clicar no botão Publicar. Verifique se está na página correta do Marketplace e se todos os campos obrigatórios foram preenchidos.',
                    debug: 'Use debugPublicacao() no console para mais informações'
                });
            }
            
            
        } catch (error) {
            console.error('[Content Script] Erro durante o processo:', error);
            enviarResposta({ success: false, error: error.message });
        }
        
        setTimeout(() => {
            if (!responseEnviada) {
                console.error(" Timeout: Enviando resposta de erro por segurança");
                enviarResposta({ success: false, error: "Timeout no processamento" });
            }
        }, 60000); // Aumentado para 60000ms
    }

    // Função para preencher o formulário do Facebook Marketplace
    async function preencherFormulario(postData) {
        console.log('[Content Script] Preenchendo formulário...');
        console.log('[Content Script] URL atual:', window.location.href);

        // =================================================================
        // ▼▼▼ ADICIONE ESTE BLOCO DE CÓDIGO AQUI ▼▼▼
        // =================================================================

        // 🚨 REMOVED - Upload de imagens será movido para ser a PRIMEIRA coisa a acontecer!
        
        // =================================================================
        // ▲▲▲ FIM DO BLOCO DE CÓDIGO ADICIONADO ▲▲▲
        // =================================================================
        
        if (!window.location.href.includes('facebook.com/marketplace')) {
            console.error('[Content Script] Não estamos na página do Facebook Marketplace');
            return false;
        }
        
        console.log('[Content Script] Aguardando página carregar...');
        let tentativasCarregamento = 0;
        while (document.readyState !== 'complete' && tentativasCarregamento < 30) {
            await new Promise(resolve => setTimeout(resolve, 500));
            tentativasCarregamento++;
        }
        
        console.log('[Content Script] Aguardando elementos aparecerem...');
        await new Promise(resolve => setTimeout(resolve, 6000)); // Espera inicial maior

        // 🚨🖼️ UPLOAD DE IMAGENS - PRIMEIRA PRIORIDADE ABSOLUTA! 🖼️🚨
        console.log('[Content Script] === 🔥 UPLOAD DE IMAGENS (PRIMEIRA PRIORIDADE) 🔥 ===');
        
        if (postData.images && postData.images.length > 0) {
            console.log(`[Content Script] 🚨 INICIANDO UPLOAD IMEDIATO! Recebidas ${postData.images.length} imagens para processar`);

            // FILTRAR E VALIDAR IMAGENS ANTES DO UPLOAD
            const imagensValidas = postData.images.filter((img, index) => {
                console.log(`[Content Script] Validando imagem ${index + 1}:`, {
                    objeto: img,
                    keys: Object.keys(img || {}),
                    name: img?.name,
                    dataUrl: img?.dataUrl ? `${img.dataUrl.substring(0, 50)}...` : 'AUSENTE',
                    size: img?.size
                });

                if (!img) {
                    console.warn(`[Content Script] Imagem ${index + 1} é null/undefined, removendo`);
                    return false;
                }

                if (!img.name || typeof img.name !== 'string') {
                    console.warn(`[Content Script] Imagem ${index + 1} sem nome válido, removendo:`, img.name);
                    return false;
                }

                if (!img.dataUrl || typeof img.dataUrl !== 'string' || !img.dataUrl.startsWith('data:')) {
                    console.warn(`[Content Script] Imagem ${index + 1} "${img.name}" sem dataUrl válido, removendo`);
                    return false;
                }

                return true;
            });

            console.log(`[Content Script] Validação concluída: ${postData.images.length} recebidas -> ${imagensValidas.length} válidas`);

            if (imagensValidas.length === 0) {
                console.log('[Content Script] ℹ️ Nenhuma imagem válida encontrada - continuando sem imagens');
                return false;
            }

            try {
                console.log('[Content Script] 🚨 EXECUTANDO UPLOAD DE IMAGENS AGORA!');
                const uploadOk = await uploadImagesWithClick(imagensValidas);
                if (uploadOk) {
                    console.log('[Content Script] ✅✅✅ UPLOAD DE IMAGENS CONCLUÍDO COM SUCESSO! ✅✅✅');
                    
                    // Aguardar tempo extra para garantir que as imagens foram processadas
                    console.log('[Content Script] ⏳ Aguardando 5-8 segundos para imagens serem totalmente processadas...');
                    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
                } else {
                    console.log('[Content Script] ⚠️ Upload de imagens não foi concluído - continuando processo');
                    // Continuar mesmo com erro de upload
                }
            } catch (error) {
                console.log('[Content Script] ⚠️ Upload de imagens encontrou problema:', error.message);
                console.error('[Content Script] Detalhes do erro:', error);
                // Continuar mesmo com erro de upload
            }
        } else {
            console.warn("[Content Script] ⚠️ Nenhum dado de imagem encontrado em postData. Pulando upload.");
        }

        console.log('[Content Script] === 📝 AGORA PROSSEGUINDO PARA PREENCHIMENTO DOS CAMPOS ===');
        
        console.log('[Content Script] === DEBUG INICIAL ===');
        debugElementosDisponiveis(); // Chama a função global
        
        try {
            let camposPreenchidos = 0;
            
            async function encontrarElemento(seletores, maxTentativas = 25, intervalo = 2000) {
                console.log(`[Content Script] Procurando elemento com ${seletores.length} seletores...`);
                
                for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
                    if (document.readyState !== 'complete') {
                        console.log('[Content Script] Aguardando página carregar completamente...');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }
                    
                    for (const seletor of seletores) {
                        try {
                            const elementos = document.querySelectorAll(seletor);
                            for (const elemento of elementos) {
                                if (elemento && 
                                    elemento.offsetParent !== null && 
                                    elemento.offsetWidth > 0 && 
                                    elemento.offsetHeight > 0 &&
                                    !elemento.disabled // Verifica se não está desabilitado
                                    ) {
                                    console.log(`[Content Script] Elemento encontrado com seletor: ${seletor} (tentativa ${tentativa + 1})`);
                                    console.log('[Content Script] Elemento:', elemento.outerHTML.substring(0, 300));
                                    return elemento;
                                }
                            }
                        } catch (e) {
                            console.warn('[Content Script] Seletor inválido:', seletor, e.message);
                        }
                    }
                    
                    if (tentativa < maxTentativas - 1) {
                        console.log(`[Content Script] Elementos não encontrados, aguardando ${intervalo}ms antes da próxima tentativa... (${tentativa + 1}/${maxTentativas})`);
                        // Apenas debuga elementos disponíveis a cada 3 tentativas para não lotar o console
                        if ((tentativa + 1) % 3 === 0) { 
                            debugElementosDisponiveis();
                        }
                        await new Promise(resolve => setTimeout(resolve, intervalo));
                    }
                }
                
                console.warn('[Content Script] Nenhum elemento encontrado após todas as tentativas, seletores testados:', seletores);
                debugElementosDisponiveis(); // Depuração extra em caso de falha
                return null;
            }

            async function aguardarElementos(seletores, timeout = 30000) {
                console.log('[Content Script] Aguardando elementos aparecerem...');
                const inicio = Date.now();
                
                while (Date.now() - inicio < timeout) {
                    for (const seletor of seletores) {
                        const elemento = document.querySelector(seletor);
                        if (elemento && elemento.offsetWidth > 0 && elemento.offsetHeight > 0) {
                            console.log(`[Content Script] Elemento encontrado: ${seletor}`);
                            return elemento;
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                console.log('[Content Script] Timeout aguardando elementos');
                return null;
            }
            
            // O primeiro aguardarElementos aqui continua para validar se a página inicial está carregada
            const primeiroElemento = await aguardarElementos([
                ...window.campos.titulo,
                ...window.campos.preco,
                ...window.campos.categoria, // Mantido aqui pois categoria é um dos primeiros a serem preenchidos
                'input[type="text"]',
                'input[type="number"]',
                'textarea',
                'div[contenteditable="true"]',
                'select',
                'div[role="combobox"]'
            ]);
            
            if (!primeiroElemento) {
                console.error('[Content Script] Nenhum campo de formulário encontrado após timeout');
                return false;
            }
            
            console.log('[Content Script] Campos detectados, iniciando preenchimento...');
            
            // 1. Preenche o Título
            if (postData.title) {
                console.log('[Content Script] Tentando preencher título:', postData.title);
                const tituloElement = await encontrarElemento(window.campos.titulo);
                if (tituloElement) {
                    await preencherCampo(tituloElement, postData.title); // Usará os novos delays padrão
                    console.log('[Content Script] Título preenchido com sucesso');
                    camposPreenchidos++;
                } else {
                    console.error('[Content Script] Campo título não encontrado');
                }
            }
            
            // Pausa específica entre Título e Preço
            console.log('[Content Script] Pausa adicional entre título e preço...');
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 500)); // 2-2.5 segundos de delay
            
            // 2. Preenche o Preço
            if (postData.preco || postData.price) {
                console.log('[Content Script] Tentando preencher preço:', postData.preco || postData.price);
                const precoElement = await encontrarElemento(window.campos.preco);
                if (precoElement) {
                    const valorFormatado = `R$ ${parseFloat(postData.preco || postData.price).toLocaleString('pt-BR')}`;
                    await preencherCampo(precoElement, valorFormatado); // Usará os novos delays padrão
                    console.log('[Content Script] Preço preenchido com sucesso');
                    camposPreenchidos++;
                } else {
                    console.error('[Content Script] Campo preço não encontrado');
                }
            }
            
            // Pausa após Título e Preço, antes de interagir com Combobox (mantido para garantir carregamento visual)
            console.log('[Content Script] Pausa de 1.5-2 segundos antes de categoria...');
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500)); 

            // 3. Seleciona Categoria usando selectCategoryPath
            if (postData.category || postData.categoria) {
                console.log('[Content Script] Tentando selecionar categoria usando selectCategoryPath');
                // Construir o array de IDs da categoria para a nova função
                const categoryPathIds = [];
                const mainCategory = postData.category || postData.categoria;
                
                // Verificar se temos categoria principal
                if (mainCategory) {
                    categoryPathIds.push(mainCategory);
                    
                    // Subcategoria removida - usando apenas categoria principal
                }
                
                console.log(`[Content Script] Array de IDs de categoria construído: ${categoryPathIds.join(' > ')}`);
                
                if (categoryPathIds.length > 0) {
                    const sucessoCategoria = await selectCategoryPath(categoryPathIds); // <<< Passa o array de IDs
                    if (sucessoCategoria) {
                        console.log('[Content Script] Caminho de categoria selecionado com sucesso');
                        // Contar quantos níveis foram selecionados
                        const niveis = categoryPathIds.length;
                        camposPreenchidos += niveis;
                    } else {
                        console.error('[Content Script] Falha ao selecionar caminho de categoria. Abortando preenchimento.');
                        return false; // Retorna false para indicar falha e abortar o preenchimento.
                    }
                } else {
                    console.error('[Content Script] Não foi possível construir um caminho de categoria válido. Abortando preenchimento.');
                    return false; // Retorna false para indicar falha e abortar o preenchimento.
                }
            }

            // Pausa após Categoria, antes de interagir com Condição (mantido para garantir carregamento visual)
            console.log('[Content Script] Pausa de 1.5-2 segundos após categoria, antes de condição...');
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));

            // 4. Seleção de "Condição"
            console.log('[Content Script] Tentando localizar e interagir com o combobox de Condição...');
            const conditionComboboxSelectors = [
                'label[role="combobox"][aria-labelledby*="_r_"][class*="x78zum5"]',
                'label[role="combobox"] span[id*="_r_"][textContent*="Condição"]',
                'label[role="combobox"][aria-label*="Condição"]',
                'div[role="combobox"][aria-label*="Condição"]',
                'input[placeholder*="Condição"]',
                'label[role="combobox"]',
                'div[role="combobox"]'
            ];

            let conditionCombobox = null;
            for (const selector of conditionComboboxSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (el && el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) {
                        if (el.textContent.includes('Condição') || el.getAttribute('aria-label')?.includes('Condição')) {
                            conditionCombobox = el;
                            break;
                        }
                        const spanChild = el.querySelector('span[textContent*="Condição"]');
                        if (spanChild) {
                            conditionCombobox = el;
                            break;
                        }
                    }
                }
                if (conditionCombobox) break;
            }

            if (conditionCombobox) {
                console.log('[Content Script] Combobox de Condição encontrado.');
                console.log('[Content Script] Conteúdo de postData:', postData);
                console.log('[Content Script] Valor de postData.condition:', postData.condition);
                
                conditionCombobox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                conditionCombobox.dispatchEvent(clickEvent);
                conditionCombobox.focus();
                
                await new Promise(resolve => setTimeout(resolve, 1500));
                console.log('[Content Script] Dropdown de Condição aberto. Opções devem estar visíveis.');

                if (postData.condition) {
                    console.log(`[Content Script] Tentando selecionar a condição: "${postData.condition}"`);
                    const conditionSelected = await selectOptionInCombobox(conditionCombobox, postData.condition);
                    if (conditionSelected) {
                        console.log(`[Content Script] Condição "${postData.condition}" selecionada com sucesso.`);
                        camposPreenchidos++;
                    } else {
                        console.error(`[Content Script] Falha ao selecionar a condição: "${postData.condition}"`);
                    }
                } else {
                    console.log('[Content Script] Nenhuma condição especificada em postData para seleção.');
                }
            } else {
                console.error('[Content Script] Combobox de Condição não encontrado após tentativas.');
            }

            // Pausa após Condição, antes de interagir com Disponibilidade
            console.log('[Content Script] Pausa de 1.5-2 segundos após condição, antes de disponibilidade...');
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));

            // 5. Seleção de "Disponibilidade"
            console.log('[Content Script] Tentando localizar e interagir com o combobox de Disponibilidade...');
            const disponibilidadeComboboxSelectors = [
                // NOVO E MAIS ESPECÍFICO SELETOR ADICIONADO AQUI
                'label[aria-labelledby*="_r_3g_"][role="combobox"][tabindex="0"]', // Seletor exato fornecido
                'label.x78zum5.xh8yej3[role="combobox"][tabindex="0"]', // Mais genérico, mas comum
                'label[role="combobox"][aria-label*="Disponibilidade"]',
                'div[role="combobox"][aria-label*="Disponibilidade"]',
                'label[role="combobox"]:has(span[textContent*="Disponibilidade"])',
                'div[role="combobox"]:has(span[textContent*="Disponibilidade"])',
                'div[role="combobox"]', // Como último recurso
                'label[role="combobox"]' // Como último recurso
            ];

            
let disponibilidadeCombobox = null;
for (const seletor of disponibilidadeComboboxSelectors) {
    const elementos = document.querySelectorAll(seletor);
    for (const el of elementos) {
        if (!el || el.offsetParent === null || el.offsetWidth === 0 || el.offsetHeight === 0) continue;

        const label = el.getAttribute('aria-label') || '';
        const innerText = el.textContent || '';

        // Verifica se o elemento ou seu aria-label ou texto visível menciona "Disponibilidade"
        if (
            label.toLowerCase().includes("disponibilidade") ||
            innerText.toLowerCase().includes("disponibilidade")
        ) {
            disponibilidadeCombobox = el;
            break;
        }

        // Verifica se o ID referenciado por aria-labelledby contém o termo
        const labelId = el.getAttribute('aria-labelledby');
        if (labelId) {
            const labelEl = document.getElementById(labelId);
            if (labelEl && labelEl.textContent.toLowerCase().includes("disponibilidade")) {
                disponibilidadeCombobox = el;
                break;
            }
        }

        // Verifica filhos span com texto
        const span = el.querySelector('span');
        if (span && span.textContent.toLowerCase().includes("disponibilidade")) {
            disponibilidadeCombobox = el;
            break;
        }
    }
    if (disponibilidadeCombobox) break;
}


            if (disponibilidadeCombobox) {
                let isCorrectCombobox = false;
                // Verificar se o elemento contém o texto "Disponibilidade" ou se o aria-label o contém
                if (disponibilidadeCombobox.textContent.includes('Disponibilidade') || (disponibilidadeCombobox.getAttribute('aria-label') && disponibilidadeCombobox.getAttribute('aria-label').includes('Disponibilidade'))) {
                    isCorrectCombobox = true;
                } else {
                    // Verificar se o elemento referenciado pelo aria-labelledby contém o texto
                    const associatedLabelId = disponibilidadeCombobox.getAttribute('aria-labelledby');
                    if (associatedLabelId) {
                        const labelElement = document.getElementById(associatedLabelId);
                        // Verifica se o texto do elemento referenciado contém "Disponibilidade"
                        if (labelElement && labelElement.textContent.includes('Disponibilidade')) {
                            isCorrectCombobox = true;
                        }
                    }
                    // Adicionalmente, verificar se algum span dentro do elemento contém "Disponibilidade"
                    const spanChild = disponibilidadeCombobox.querySelector('span[textContent*="Disponibilidade"]');
                    if (spanChild) {
                        isCorrectCombobox = true;
                    }
                }


                if (!isCorrectCombobox) {
                    console.warn('[Content Script] Encontrado um combobox, mas não parece ser o de "Disponibilidade". Tentando continuar com ele, mas pode falhar.');
                }

                console.log('[Content Script] Combobox de Disponibilidade encontrado.');
                const optionToSelect = postData.disponibilidade || "Anunciar como Em estoque";
                
                if (optionToSelect) {
                    // Verifica se já está como "Em estoque" no próprio combobox
                    const atual = disponibilidadeCombobox.textContent.trim().toLowerCase();
                    if (atual.includes("em estoque")) {
                        console.log(`[Content Script] Disponibilidade já está como "Em estoque". Pulando seleção.`);
                    } else {
                        console.log(`[Content Script] Tentando selecionar a disponibilidade: "${optionToSelect}"`);
                        const availabilitySelected = await selectOptionInCombobox(disponibilidadeCombobox, optionToSelect);
                        if (availabilitySelected) {
                            console.log(`[Content Script] Disponibilidade "${optionToSelect}" selecionada com sucesso.`);
                            camposPreenchidos++;
                        } else {
                            console.error(`[Content Script] Falha ao selecionar a disponibilidade: "${optionToSelect}"`);
                        }
                    }
                } else {
                    console.log('[Content Script] Nenhuma disponibilidade especificada em postData para seleção.');
                }
            } else {
                console.error('[Content Script] Combobox de Disponibilidade não encontrado após tentativas.');
            }

            // Pausa após Disponibilidade, antes de tentar a Descrição
            console.log('[Content Script] Pausa de 3-4 segundos após disponibilidade, antes da descrição...');
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 1000));

            // 6. Preenche a Localização
            if (postData.localizacao || postData.location) {
                // Delay adicional específico antes da localização
                console.log('[Content Script] Delay adicional de 2-3 segundos antes de preencher localização...');
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
                
                console.log('[Content Script] Tentando preencher localização:', postData.localizacao || postData.location);
                const localizacaoElement = await encontrarElemento(window.campos.localizacao, 30, 1000); // Aumentado tentativas e intervalo
                if (localizacaoElement) {
                    // Garantir que o campo está limpo antes de preencher
                    localizacaoElement.value = '';
                    await preencherCampo(localizacaoElement, postData.localizacao || postData.location, 100, 2000);
                    console.log('[Content Script] Localização preenchida com:', postData.localizacao || postData.location);
                    
                    // Esperar sugestões carregarem
                    console.log('[Content Script] Aguardando 2-3s para sugestões de localização carregarem...');
                    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
                    
                    // Tentar selecionar a sugestão correta
                    const expectedLocation = (postData.localizacao || postData.location) + ", Brazil";
                    const clicked = await clickDefaultSuggestion(expectedLocation, 15); // Aumentado tentativas
                    
                    if (clicked) {
                        console.log('[Content Script] Sugestão de localização clicada com sucesso:', expectedLocation);
                        camposPreenchidos++;
                    } else {
                        console.error('[Content Script] Falha ao clicar na sugestão de localização:', expectedLocation);
                        console.error('[Content Script] Fallback desnecessário removido.');
                    }
                } else {
                    console.error('[Content Script] Campo localização não encontrado');
                }
            }
            
            // 7. Preenche a Descrição
            if (postData.descricao || postData.description) {
                console.log('[Content Script] Tentando preencher descrição');
                const descricaoElement = await encontrarElemento(window.campos.descricao);
                if (descricaoElement) {
                    await preencherCampo(descricaoElement, postData.descricao || postData.description);
                    console.log('[Content Script] Descrição preenchida com sucesso');
                    camposPreenchidos++;
                } else {
                    console.error('[Content Script] Campo descrição não encontrado');
                }
            }

            console.log('[Content Script] Total de campos preenchidos:', camposPreenchidos);
            return camposPreenchidos > 0;
        } catch (error) {
            console.error('[Content Script] Erro durante preenchimento:', error);
            return false;
        }
    }
    async function preencherCampo(elemento, valor, charDelay = 100, afterFieldDelay = 1500) {
        if (!elemento || !valor) return;
        try {
            console.log('[Content Script] Preenchendo campo:', elemento.tagName, elemento.getAttribute('aria-label') || elemento.placeholder);
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500)); // Atraso de 1000-1500ms antes de iniciar
            elemento.focus();
            elemento.click(); // Garante que o elemento está clicável e focado
    // Delay específico para o campo de localização
    if ((elemento.getAttribute('aria-label') || '').toLowerCase().includes('localização') ||
        (elemento.placeholder || '').toLowerCase().includes('localização')) {
        console.log('[Content Script] Campo é de localização, aguardando delay extra...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

            
            // Delay adicional após focus/click para estabilizar o campo
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400)); // Atraso de 800-1200ms após focus
            if (elemento.contentEditable === 'true') {
                elemento.textContent = ''; // Limpa o campo uma vez
                elemento.innerHTML = '';
                for (let i = 0; i < valor.length; i++) {
                    elemento.textContent += valor[i]; // Adiciona caractere por caractere
                    elemento.innerHTML = elemento.textContent; // Atualiza o innerHTML
                    const char = valor[i];
                    const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true });
                    elemento.dispatchEvent(keydownEvent);
                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    elemento.dispatchEvent(inputEvent);
                    const keyupEvent = new Event('keyup', { key: char, bubbles: true, cancelable: true });
                    elemento.dispatchEvent(keyupEvent);
                    await new Promise(resolve => setTimeout(resolve, charDelay + Math.random() * 100)); // 100-200ms
                }
                const eventosContentEditable = ['change', 'blur'];
                eventosContentEditable.forEach(tipoEvento => {
                    const evento = new Event(tipoEvento, { bubbles: true, cancelable: true });
                    elemento.dispatchEvent(evento);
                });
            } else { // Para input/textarea
                elemento.value = ''; // Limpa o campo uma vez
                for (let i = 0; i < valor.length; i++) {
                    elemento.value += valor[i]; // Adiciona caractere por caractere
                    const char = valor[i];
                    const keydownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true });
                    elemento.dispatchEvent(keydownEvent);
                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                    elemento.dispatchEvent(inputEvent);
                    const keyupEvent = new Event('keyup', { key: char, bubbles: true, cancelable: true });
                    elemento.dispatchEvent(keyupEvent);
                    await new Promise(resolve => setTimeout(resolve, charDelay + Math.random() * 100)); // 100-200ms
                }
                const eventos = ['change', 'blur'];
                eventos.forEach(tipoEvento => {
                    const evento = new Event(tipoEvento, { bubbles: true, cancelable: true });
                    elemento.dispatchEvent(evento);
                });
            }
            const eventoReact = new Event('input', { bubbles: true });
            Object.defineProperty(eventoReact, 'target', { value: elemento, enumerable: true });
            elemento.dispatchEvent(eventoReact);
            console.log('[Content Script] Campo preenchido com sucesso:', valor);
            await new Promise(resolve => setTimeout(resolve, afterFieldDelay + Math.random() * 200)); // 1500-1700ms
        } catch (error) {
            console.error('[Content Script] Erro ao preencher campo:', error);
        }
    }
    // ========================================
    // FUNÇÃO DE PUBLICAÇÃO - DESCOMENTE PARA ATIVAR
    // ========================================
    // ATENÇÃO: Esta função está comentada para evitar publicação automática
    // Para ativar a publicação automática, descomente esta função e
    // descomente também as linhas na função preencherEPublicarPost
    
    function clicarEmPublicar() {
        console.log('[Content Script] Procurando botão publicar...');
        return new Promise((resolve) => {
            setTimeout(() => {
                const seletores = [
                    'div[aria-label="Publicar"][role="button"]',
                    'div[aria-label="Publish"][role="button"]',
                    'button[aria-label="Publicar"]',
                    'button[aria-label="Publish"]',
                    'div[data-testid="marketplace-composer-publish-button"]',
                    'button[data-testid="marketplace-composer-publish-button"]',
                    'div[role="button"][aria-label="Publicar anúncio"]',
                    'div[role="button"][aria-label="Publish listing"]',
                    'button[aria-label="Postar"]',
                    'button[aria-label="Post"]',
                    'button[aria-label="Enviar"]',
                    'button[aria-label="Submit"]',
                    'button[aria-label="Criar anúncio"]',
                    'button[aria-label="Create listing"]',
                    'button[type="submit"]',
                    'input[type="submit"]',
                    'div[role="button"][aria-label*="Publicar"]',
                    'div[role="button"][aria-label*="Publish"]',
                    'span[role="button"][aria-label*="Publicar"]',
                    'span[role="button"][aria-label*="Publish"]',
                    'form button:last-of-type',
                    'div[role="main"] button[type="submit"]',
                    'div[role="main"] div[role="button"]:last-child'
                ];
                let botaoPublicar = null;
                for (const seletor of seletores) {
                    try {
                        botaoPublicar = document.querySelector(seletor);
                        if (botaoPublicar && botaoPublicar.offsetParent !== null) {
                            console.log(`[Content Script] Botão encontrado com seletor: ${seletor}`);
                            break;
                        }
                    } catch (e) {}
                }
                if (!botaoPublicar) {
                    const elementos = document.querySelectorAll('button, input[type="submit"], div[role="button"], span[role="button"]');
                    const textosPublicar = ['Publicar', 'Publish', 'Postar', 'Post', 'Enviar', 'Submit', 'Criar', 'Create'];
                    for (const elemento of elementos) {
                        if (elemento.offsetParent === null) continue;
                        const texto = elemento.textContent || elemento.value || elemento.getAttribute('aria-label') || '';
                        if (textosPublicar.some(t => texto.toLowerCase().includes(t.toLowerCase()))) {
                            botaoPublicar = elemento;
                            console.log(`[Content Script] Botão encontrado por texto: "${texto}"`);
                            break;
                        }
                    }
                }
                if (botaoPublicar) {
                    try {
                        console.log('[Content Script] Tentando clicar no botão publicar...');
                        botaoPublicar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => {
                            botaoPublicar.click();
                            setTimeout(() => {
                                const clickEvent = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                                botaoPublicar.dispatchEvent(clickEvent);
                            }, 200);
                            // REMOVIDO: Fallback Enter desnecessário
                            console.log('[Content Script] Botão publicar clicado!');
                            resolve(true);
                        }, 1000); // Aumentado para 1000ms
                    } catch (error) {
                        console.error('[Content Script] Erro ao clicar no botão:', error);
                        resolve(false);
                    }
                } else {
                    console.warn('[Content Script] Botão publicar não encontrado');
                    const todosBotoes = document.querySelectorAll('button, input[type="submit"], div[role="button"], span[role="button"]');
                    console.log('[Content Script] Elementos clicáveis encontrados na página:');
                    todosBotoes.forEach((botao, index) => {
                        if (botao.offsetParent !== null) {
                            const texto = botao.textContent || botao.value || botao.getAttribute('aria-label') || 'sem texto';
                            const classes = botao.className || 'sem classes';
                            const testId = botao.getAttribute('data-testid') || 'sem testid';
                            const role = botao.getAttribute('role') || botao.tagName.toLowerCase();
                            console.log(`  ${index + 1}. Tipo: ${role}, Texto: "${texto.trim()}", Classes: "${classes}", TestID: "${testId}"`);
                        }
                    });
                    resolve(false);
                }
            }, 1500); // Aumentado para 1500ms
        });
    }

    async function clickDefaultSuggestion(localizacaoEsperada = "Sinop, Brazil", maxTentativas = 15) {
        console.log(`[Content Script] Iniciando clickDefaultSuggestion para: "${localizacaoEsperada}"`);
    
        const normalizedSearchText = localizacaoEsperada.trim().toLowerCase();
    
        // Seletores expandidos para cobrir mais casos de sugestões de localização
        const suggestionSelectors = [
            'div[role="option"]', // Padrão para sugestões
            'li[role="option"]',
            'div[tabindex="-1"]', // Usado em alguns dropdowns do Facebook
            'span[id^="_r_"]',
            'div[class*="x1n2onr6"]', // Classes comuns no Marketplace
            'div[class*="x193iq5w"]',
            'div[class*="x1y1aw1k"]',
            'div[aria-label*="Opção"]',
            'div[aria-label*="Suggestion"]',
            'div[class*="xexx8yu"]', // Adicionado para cobrir possíveis containers de sugestões
            'div[class*="x4uap5"]'
        ];
    
        for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
            console.log(`[Content Script] Tentativa ${tentativa + 1}/${maxTentativas} para encontrar sugestão: "${localizacaoEsperada}"`);
            
            // Debug: listar todas as sugestões visíveis
            debugElementosDisponiveis();
            
            let suggestionElement = null;
            let exactMatch = null;
            let partialMatch = null;
    
            for (const selector of suggestionSelectors) {
                const sugestoes = Array.from(document.querySelectorAll(selector)).filter(el =>
                    el.offsetParent !== null &&
                    el.offsetWidth > 0 &&
                    el.offsetHeight > 0
                );
    
                console.log(`[Content Script] Encontradas ${sugestoes.length} sugestões com seletor: ${selector}`);
    
                for (const el of sugestoes) {
                    let checkText = '';
                    // Extração de texto robusta
                    let ariaLabel = el.getAttribute('aria-label') || '';
                    let title = el.getAttribute('title') || '';
                    let textContent = el.textContent.trim();
                    let nestedElements = el.querySelectorAll('span, div');
                    let nestedText = '';
                    for (let nestedEl of nestedElements) {
                        let tempText = nestedEl.textContent.trim();
                        if (tempText.length > nestedText.length) {
                            nestedText = tempText;
                        }
                        let nestedAriaLabel = nestedEl.getAttribute('aria-label') || '';
                        if (nestedAriaLabel.length > nestedText.length) {
                            nestedText = nestedAriaLabel;
                        }
                    }
    
                    // Escolher o texto mais relevante
                    checkText = [ariaLabel, title, textContent, nestedText]
                        .filter(t => t)
                        .reduce((a, b) => a.length > b.length ? a : b, '');
    
                    const normalizedCheckText = checkText.trim().toLowerCase();
    
                    console.log(`[Content Script] Verificando elemento com texto: "${checkText}"`);
    
                    if (normalizedCheckText === normalizedSearchText) {
                        exactMatch = el;
                        console.log(`[Content Script] Correspondência EXATA encontrada: "${checkText}"`);
                        break;
                    } else if (normalizedCheckText.includes(normalizedSearchText)) {
                        partialMatch = el;
                        console.log(`[Content Script] Correspondência PARCIAL encontrada: "${checkText}"`);
                    }
                }
                if (exactMatch) break;
            }
    
            suggestionElement = exactMatch || partialMatch;
    
            if (suggestionElement) {
                console.log(`[Content Script] Elemento de sugestão encontrado: "${suggestionElement.textContent.trim()}"`);
                
                // Encontrar o elemento clicável mais próximo
                let clickableElement = suggestionElement;
                let parent = suggestionElement;
                let depth = 0;
                while (parent && depth < 3) {
                    if (parent.getAttribute('role') === 'option' || parent.getAttribute('tabindex') === '-1') {
                        clickableElement = parent;
                        break;
                    }
                    parent = parent.parentElement;
                    depth++;
                }
    
                console.log('[Content Script] Elemento clicável selecionado:', {
                    tag: clickableElement.tagName,
                    classes: clickableElement.className,
                    role: clickableElement.getAttribute('role') || 'N/A',
                    outerHTML: clickableElement.outerHTML.substring(0, 200)
                });
    
                // Garantir que o elemento está visível
                clickableElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
    
                // Tentar clique nativo
                try {
                    clickableElement.click();
                    console.log('[Content Script] Clique nativo realizado na sugestão.');
                } catch (e) {
                    console.warn('[Content Script] Erro no clique nativo, tentando simulação de evento:', e);
                    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                    clickableElement.dispatchEvent(clickEvent);
                    clickableElement.focus();
                    console.log('[Content Script] Clique simulado realizado na sugestão.');
                }

                // REMOVIDO: Fallback Enter desnecessário

                // Aguardar a UI atualizar após o clique
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Verificar se a localização foi aceita corretamente
                const locationInput = document.querySelector(campos.localizacao.join(', '));
                if (locationInput && locationInput.value.toLowerCase().includes('brazil')) {
                    console.log('[Content Script] Localização confirmada com sucesso:', locationInput.value);
                    return true;
                } else {
                    console.warn('[Content Script] Localização não confirmada após clique. Valor atual:', locationInput ? locationInput.value : 'N/A');
                }
            } else {
                console.log(`[Content Script] Nenhuma sugestão encontrada na tentativa ${tentativa + 1}. Aguardando...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.error(`[Content Script] Falha ao encontrar ou clicar na sugestão "${localizacaoEsperada}" após ${maxTentativas} tentativas.`);
        // Fechar o dropdown como precaução
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
    }

    // Função auxiliar para encontrar elementos com retentativas (já definida anteriormente, incluída para completude)
    async function encontrarElemento(seletores, maxTentativas = 20, intervaloMs = 500) {
        let tentativa = 0;
        while (tentativa < maxTentativas) {
            for (const seletor of seletores) {
                try {
                    const elemento = document.querySelector(seletor);
                    if (elemento && elemento.offsetParent !== null && elemento.offsetWidth > 0 && elemento.offsetHeight > 0 && !elemento.disabled) {
                        console.log(`[Content Script] Elemento encontrado com seletor: ${seletor}`);
                        return elemento;
                    }
                } catch (e) {
                    console.warn(`[Content Script] Erro ao tentar seletor '${seletor}': ${e.message}`);
                }
            }
            console.log(`[Content Script] Tentativa ${tentativa + 1}/${maxTentativas}: Elemento não encontrado ou não visível. Aguardando...`);
            await new Promise(resolve => setTimeout(resolve, intervaloMs));
            tentativa++;
        }
        console.error(`[Content Script] Falha ao encontrar elemento após ${maxTentativas} tentativas com seletores:`, seletores);
        return null;
    }

    // (O restante do código, como outras funções e listeners, permanece inalterado)
}

// ############ FUNÇÕES DE UPLOAD DE IMAGEM ############

// Função auxiliar para converter DataURL para File, essencial para injeção
function dataURLtoFile(dataurl, filename) {
    // Verificações de segurança
    if (!dataurl) {
        console.error('[Content Script] dataURLtoFile: dataurl está undefined ou vazio', { dataurl, filename });
        throw new Error('DataURL não pode estar vazio');
    }
    
    if (typeof dataurl !== 'string') {
        console.error('[Content Script] dataURLtoFile: dataurl não é uma string', { dataurl, filename, type: typeof dataurl });
        throw new Error('DataURL deve ser uma string');
    }
    
    if (!dataurl.includes(',')) {
        console.error('[Content Script] dataURLtoFile: dataurl não contém vírgula (formato inválido)', { dataurl, filename });
        throw new Error('DataURL tem formato inválido - deve conter vírgula');
    }
    
    console.log(`[Content Script] dataURLtoFile: Convertendo ${filename}, dataURL length: ${dataurl.length}`);
    
    try {
        let arr = dataurl.split(','),
            mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]),
            n = bstr.length,
            u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        console.log(`[Content Script] dataURLtoFile: Arquivo criado com sucesso - ${filename}, tipo: ${mime}, tamanho: ${n} bytes`);
        console.log(`[Content Script] NOTA: Dados EXIF preservados - nenhuma remoção ou processamento feito`);
        return new File([u8arr], filename, { type: mime });
    } catch (error) {
        console.error('[Content Script] dataURLtoFile: Erro na conversão', { error, dataurl: dataurl.substring(0, 100), filename });
        throw error;
    }
}

// Função principal para injetar imagens no campo de upload (VERSÃO OTIMIZADA DA V1)
async function uploadImages(images) {
    console.log('[Content Script] Iniciando upload de imagens...');

    let fileInput = null;
    // Seletor específico e mais confiável para o input de arquivo do Facebook Marketplace
    const specificSelector = 'input[type="file"].x1s85apg';
    // Seletores genéricos como fallback, caso o específico não seja encontrado imediatamente
    const fallbackSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]'
    ];
    
    let attempts = 0;
    const maxAttempts = 90; // Aumentado para 90 tentativas (até 1.5 minuto de espera)
    const intervalMs = 1000; // 1 segundo de intervalo entre tentativas

    // Tentar encontrar o input de arquivo até o limite de tentativas
    while (!fileInput && attempts < maxAttempts) {
        fileInput = document.querySelector(specificSelector); // Tenta o seletor específico primeiro

        if (!fileInput) { // Se não encontrou o específico, tenta os fallbacks
            for (const selector of fallbackSelectors) {
                fileInput = document.querySelector(selector);
                if (fileInput) break; // Encontrou um, sai do loop interno
            }
        }
        
        if (!fileInput) {
            console.log(`[Content Script] Input de arquivo não encontrado (tentativa ${attempts + 1}/${maxAttempts}). Aguardando...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            attempts++;
        }
    }

    // Se o input não foi encontrado após todas as tentativas, lança um erro
    if (!fileInput) {
        throw new Error('CRÍTICO: Campo de upload de imagem não encontrado após monitoramento prolongado. Abortando upload.');
    }

    console.log('[Content Script] Campo de input de imagem FINALMENTE encontrado:', fileInput);
    
    // Armazenar o estilo original do input para restaurá-lo depois
    const computedStyle = window.getComputedStyle(fileInput);
    const originalDisplay = computedStyle.display;
    const originalVisibility = computedStyle.visibility;
    const originalOpacity = computedStyle.opacity;

    try {
        // Se o input estiver desabilitado, habilita-o temporariamente
        if (fileInput.disabled) {
            fileInput.disabled = false;
            console.log('[Content Script] Input de arquivo estava desabilitado, agora habilitado.');
        }

        // Tornar o input temporariamente visível e interagível, movendo-o para fora da tela
        if (originalDisplay === 'none' || originalVisibility === 'hidden' || originalOpacity === '0') {
            fileInput.style.display = 'block'; 
            fileInput.style.visibility = 'visible';
            fileInput.style.opacity = '1';
            fileInput.style.position = 'absolute';
            fileInput.style.left = '-9999px';
            fileInput.style.top = '-9999px';
            console.log('[Content Script] Input temporariamente visível e posicionado fora da tela para injeção de arquivos.');
        }
        
        // MÉTODO DA V1: Processar cada imagem individualmente para melhor compatibilidade
        for (const imageData of images) {
            try {
                console.log(`[Content Script] Processando imagem: ${imageData.name}`);

                // Converter os dados Base64 da imagem para um objeto File usando método da V1
                const imageFile = dataURLtoFile(imageData.dataUrl, imageData.name);
                
                // MÉTODO DA V1: Criar novo DataTransfer para cada imagem
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(imageFile);

                // Atribuir o objeto FileList (que contém o arquivo) ao campo de input
                fileInput.files = dataTransfer.files;

                // MÉTODO DA V1: Disparar sequência completa de eventos para garantir compatibilidade
                const events = [
                    new Event('change', { bubbles: true, cancelable: true }), 
                    new Event('input', { bubbles: true, cancelable: true }), 
                    new UIEvent('change', { bubbles: true, cancelable: true, view: window }) 
                ];

                for (const event of events) {
                    fileInput.dispatchEvent(event);
                    await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay entre eventos
                }

                console.log(`[Content Script] Imagem "${imageData.name}" injetada com sucesso no input.`);

                // MÉTODO DA V1: Verificação inteligente da miniatura
                const sucesso = await waitUntilImageAppears(imageData.name, 20, 1000); // espera até 20s
                
                if (sucesso) {
                    console.log(`[Content Script] Upload da imagem "${imageData.name}" confirmado com sucesso!`);
                } else {
                    console.warn(`[Content Script] Upload da imagem "${imageData.name}" pode ter falhado - miniatura não detectada.`);
                }

            } catch (error) {
                console.error(`[Content Script] Erro ao processar a imagem "${imageData.name}":`, error);
            }
        }
    } finally {
        // Sempre restaurar o estilo original do input, mesmo que ocorram erros
        if (fileInput) { 
            fileInput.style.display = originalDisplay;
            fileInput.style.visibility = originalVisibility;
            fileInput.style.opacity = originalOpacity;
            fileInput.style.position = ''; // Remove as propriedades de posicionamento
            fileInput.style.left = '';
            fileInput.style.top = '';
            console.log('[Content Script] Estilo do input revertido para o original.');
        }
    }
}

// Função para aguardar até que a miniatura da imagem apareça
async function waitUntilImageAppears(nomeArquivo, maxTentativas = 20, intervalo = 1000) {
    console.log(`[Upload Check] Aguardando miniatura da imagem "${nomeArquivo}" aparecer...`);

    for (let i = 0; i < maxTentativas; i++) {
        const imagensVisiveis = Array.from(document.querySelectorAll('img'))
            .filter(img => img.offsetParent !== null && img.src && img.src.includes(nomeArquivo));

        if (imagensVisiveis.length > 0) {
            console.log(`[Upload Check] Miniatura da imagem "${nomeArquivo}" detectada!`);
            return true;
        }

        console.log(`[Upload Check] Miniatura não detectada. Tentativa ${i + 1}/${maxTentativas}. Esperando...`);
        await new Promise(resolve => setTimeout(resolve, intervalo));
    }

    console.warn(`[Upload Check] Miniatura da imagem "${nomeArquivo}" NÃO apareceu após ${maxTentativas} tentativas.`);
    return false;
}

// REMOVIDO: Função robustClick desnecessária - usando clique simples

// Função para aguardar que as miniaturas carreguem
async function esperarMiniaturasCarregarem(quantidadeEsperada, timeoutMs = 20000) {
    const inicio = Date.now();
    console.log(`[Upload] Esperando até ${quantidadeEsperada} miniaturas aparecerem...`);

    while (Date.now() - inicio < timeoutMs) {
        const miniaturas = Array.from(document.querySelectorAll('img'))
            .filter(img =>
                img.offsetParent !== null &&
                img.naturalWidth > 30 &&
                img.naturalHeight > 30 &&
                !img.src.includes('data:image/gif') // ignora loaders
            );

        console.log(`[Upload] ${miniaturas.length}/${quantidadeEsperada} miniaturas visíveis.`);
        if (miniaturas.length >= quantidadeEsperada) {
            console.log('[Upload] Todas as miniaturas detectadas com sucesso!');
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.warn('[Upload] Timeout ao esperar miniaturas. Algumas podem não ter carregado.');
    return false;
}

// Função para iniciar o processo de upload de imagens, incluindo o clique no botão "Adicionar fotos"
async function uploadImagesWithClick(images) {
    console.log('[Content Script] === INÍCIO DA FUNÇÃO uploadImagesWithClick ===');
    console.log('[Content Script] Parâmetros recebidos:', {
        images: images,
        imagesType: typeof images,
        imagesIsArray: Array.isArray(images),
        imagesLength: images ? images.length : 'N/A'
    });
    
    // Debug detalhado das imagens recebidas
    debugImagensRecebidas(images);

    if (!images || images.length === 0) {
        console.log('[Content Script] ℹ️ Nenhuma imagem fornecida para upload - continuando sem imagens.');
        return false;
    }

    // Log detalhado de cada imagem recebida
    console.log('[Content Script] === DIAGNÓSTICO COMPLETO DAS IMAGENS RECEBIDAS ===');
    images.forEach((img, index) => {
        console.log(`[Content Script] Imagem ${index + 1}:`, {
            objeto: img,
            tipo: typeof img,
            keys: img ? Object.keys(img) : 'N/A',
            name: img?.name,
            nameType: typeof img?.name,
            hasDataUrl: !!img?.dataUrl,
            dataUrlType: typeof img?.dataUrl,
            dataUrlValid: img?.dataUrl ? img.dataUrl.startsWith('data:') : false,
            size: img?.size,
            order: img?.order
        });
    });


    // 1. Procurar o input de imagem
    let inputFile = document.querySelector('input[type="file"][accept*="image"]');
    if (!inputFile) {
        console.log('[Content Script] ℹ️ Campo de upload de imagem não encontrado - continuando sem imagens');
            console.log('[Content Script] Seletores tentados: input[type="file"][accept*="image"]');
        
        // Debug: listar todos os inputs de arquivo na página
        const todosInputsFile = document.querySelectorAll('input[type="file"]');
        console.log(`[Content Script] Inputs de arquivo encontrados na página: ${todosInputsFile.length}`);
        todosInputsFile.forEach((input, index) => {
            console.log(`[Content Script] Input ${index + 1}:`, {
                elemento: input,
                accept: input.accept,
                multiple: input.multiple,
                style: input.style.cssText,
                visivel: input.offsetParent !== null
            });
        });
        
        return false;
    }

    console.log('[Content Script] Campo de input de imagem FINALMENTE encontrado:', {
        elemento: inputFile,
        accept: inputFile.accept,
        multiple: inputFile.multiple,
        visivel: inputFile.offsetParent !== null
    });

    // 3. Tornar o input visível temporariamente se necessário
    const estiloOriginal = {
        display: inputFile.style.display,
        visibility: inputFile.style.visibility,
        opacity: inputFile.style.opacity,
        position: inputFile.style.position,
        top: inputFile.style.top,
        left: inputFile.style.left
    };

    inputFile.style.display = 'block';
    inputFile.style.visibility = 'visible';
    inputFile.style.opacity = '1';
    inputFile.style.position = 'absolute';
    inputFile.style.top = '0';
    inputFile.style.left = '0';

    console.log('[Content Script] Input temporariamente visível e posicionado para injeção de arquivos.');

    // 4. Criar os arquivos e inserir no input (MÉTODO DA V1 OTIMIZADO)
    const dataTransfer = new DataTransfer();
    let imagensProcessadas = 0;
    const imagensJaProcessadas = new Set(); // Para evitar duplicatas
    
    console.log(`[Content Script] 🔍 Verificando duplicatas antes do processamento...`);
    images.forEach((img, index) => {
        const chave = `${img.name}-${img.dataUrl?.length || 0}`;
        console.log(`[Content Script] Imagem ${index + 1}: "${img.name}" | Chave: ${chave}`);
    });
    
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // VALIDAÇÃO COMPLETA DOS DADOS DA IMAGEM
        console.log(`[Content Script] === Processando imagem ${i + 1}/${images.length} ===`);
        console.log(`[Content Script] Dados completos da imagem:`, {
            objeto: img,
            keys: Object.keys(img || {}),
            hasName: img && typeof img.name !== 'undefined',
            hasDataUrl: img && typeof img.dataUrl !== 'undefined',
            name: img?.name,
            nameType: typeof img?.name,
            dataUrlExists: !!img?.dataUrl,
            dataUrlType: typeof img?.dataUrl,
            dataUrlLength: img?.dataUrl ? img.dataUrl.length : 0,
            dataUrlStart: img?.dataUrl ? img.dataUrl.substring(0, 50) + '...' : 'N/A'
        });

        // Verificações críticas
        if (!img) {
            console.log(`[Content Script] ⚠️ Imagem ${i + 1} não está disponível - pulando`);
            continue;
        }

        if (!img.name || typeof img.name !== 'string' || img.name.trim() === '') {
            console.log(`[Content Script] ⚠️ Nome inválido para imagem ${i + 1}:`, img.name);
            // Gerar nome de fallback
            const fallbackName = `imagem_${Date.now()}_${i + 1}.jpg`;
            console.warn(`[Content Script] Usando nome de fallback: ${fallbackName}`);
            img.name = fallbackName;
        }

        if (!img.dataUrl || typeof img.dataUrl !== 'string' || img.dataUrl.trim() === '') {
            console.log(`[Content Script] ⚠️ Dados inválidos para imagem "${img.name}" - pulando`);
            console.error(`[Content Script] DataUrl recebido:`, {
                value: img.dataUrl,
                type: typeof img.dataUrl,
                length: img.dataUrl ? img.dataUrl.length : 0
            });
            continue; // Pular esta imagem
        }

        if (!img.dataUrl.startsWith('data:')) {
            console.error(`[Content Script] ERRO: dataUrl não tem formato correto para "${img.name}": ${img.dataUrl.substring(0, 50)}`);
            continue; // Pular esta imagem
        }

        // Verificar duplicatas antes de processar
        const chaveImagem = `${img.name}-${img.dataUrl.length}`;
        if (imagensJaProcessadas.has(chaveImagem)) {
            console.warn(`[Content Script] ⚠️ DUPLICATA DETECTADA: "${img.name}" já foi processada, pulando...`);
            continue;
        }
        imagensJaProcessadas.add(chaveImagem);

        // Método da V1: Converter usando dataURLtoFile com verificações de segurança
        try {
            console.log(`[Content Script] Convertendo imagem válida: "${img.name}"`);
            console.log(`[Content Script] DataURL preview: ${img.dataUrl.substring(0, 100)}...`);
            
            const file = dataURLtoFile(img.dataUrl, img.name);
            console.log(`[Content Script] Arquivo convertido:`, {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            });
            
            dataTransfer.items.add(file);
            imagensProcessadas++;
            console.log(`[Content Script] ✅ Imagem processada: "${img.name}", tamanho: ${file.size} bytes`);
        } catch (error) {
            console.log(`[Content Script] ⚠️ Problema ao processar imagem "${img.name}":`, error.message);
            console.error(`[Content Script] Tipo do erro:`, error.name);
            console.error(`[Content Script] Stack trace:`, error.stack);
            console.error(`[Content Script] Dados da imagem que causou erro:`, {
                name: img.name,
                dataUrlLength: img.dataUrl?.length,
                dataUrlStart: img.dataUrl?.substring(0, 50)
            });
            continue; // Pular esta imagem e continuar com as outras
        }
    }

    console.log(`[Content Script] === RESUMO DO PROCESSAMENTO ===`);
    console.log(`[Content Script] Total de imagens recebidas: ${images.length}`);
    console.log(`[Content Script] Imagens processadas com sucesso: ${imagensProcessadas}`);
    console.log(`[Content Script] Imagens com erro: ${images.length - imagensProcessadas}`);

    if (imagensProcessadas === 0) {
        console.log(`[Content Script] ℹ️ Nenhuma imagem foi processada - continuando sem imagens`);
                console.log(`[Content Script] Possíveis causas: formato de imagem inválido, dataURL corrompido, ou erro na conversão`);
        
        // Restaurar o estilo original do input antes de retornar
        Object.assign(inputFile.style, estiloOriginal);
        
        return false; // Retornar false ao invés de lançar erro
    }

    inputFile.files = dataTransfer.files;

    const event = new Event('change', { bubbles: true });
    inputFile.dispatchEvent(event);

    console.log(`[Content Script] ${images.length} imagens injetadas com sucesso no input.`);

    // 5. Restaurar o estilo original do input
    Object.assign(inputFile.style, estiloOriginal);
    console.log('[Content Script] Estilo do input revertido para o original.');

    // 6. Simular movimento do mouse (ajuda a renderizar às vezes)
    window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 100 + Math.random() * 100,
        clientY: 200 + Math.random() * 100
    }));

    // 7. Aguardar miniaturas
    const sucesso = await esperarMiniaturasCarregarem(images.length);
    if (!sucesso) {
        console.warn('[Content Script] Nem todas as miniaturas apareceram no tempo esperado.');
    }

    return true;
}

// Observer para detectar quando o input de arquivo aparece
function observeFileInput(callback) {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const inputs = document.querySelectorAll('input[type="file"][accept*="image"]');
                if (inputs.length > 0) {
                    console.log('[Content Script] Input de arquivo detectado via observer');
                    callback(inputs[0]);
                    observer.disconnect();
                    return;
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    return observer;
}

function debugFileInputs() {
    const inputs = document.querySelectorAll('input[type="file"]');
    console.log(`[DEBUG] Total de inputs file encontrados: ${inputs.length}`);
    
    inputs.forEach((input, index) => {
        console.log(`[DEBUG] Input ${index + 1}:`, {
            classes: input.className,
            accept: input.accept,
            multiple: input.multiple,
            disabled: input.disabled,
            visible: input.offsetParent !== null,
            parent: input.parentElement?.tagName
        });
    });
}

async function clicarBotaoAvancar(timeout = 30000) {
    console.log('[Content Script] Tentando clicar no botão "Avançar"...');

    // Seletores expandidos para cobrir diferentes variações do botão Avançar
    const seletoresAvancar = [
        // Seletores específicos para "Avançar"
        'div[role="button"][aria-label="Avançar"]',
        'div[role="button"][aria-label="Next"]',
        'button[aria-label="Avançar"]',
        'button[aria-label="Next"]',
        
        // Seletores por texto
        'div[role="button"]:has-text("Avançar")',
        'div[role="button"]:has-text("Next")',
        'button:has-text("Avançar")',
        'button:has-text("Next")',
        
        // Seletores genéricos que podem conter Avançar
        'div[role="button"]',
        'button[type="button"]',
        'button:not([type])',
        'span[role="button"]',
        
        // Seletores específicos do Facebook
        'div[data-testid*="next"]',
        'div[data-testid*="continue"]',
        'div[data-testid*="advance"]',
        
        // Seletores de formulário
        'form button:last-of-type',
        'form div[role="button"]:last-of-type'
    ];

    const inicio = Date.now();
    let tentativa = 0;
    
    while (Date.now() - inicio < timeout) {
        tentativa++;
        console.log(`[Content Script] Tentativa ${tentativa} - Procurando botão "Avançar"...`);
        
        let botaoEncontrado = null;
        
        // Primeiro, tentar seletores específicos
        for (const seletor of seletoresAvancar.slice(0, 8)) { // Primeiros 8 são específicos
            try {
                const elementos = document.querySelectorAll(seletor);
                for (const elemento of elementos) {
                    if (elemento && elemento.offsetParent !== null && elemento.offsetWidth > 0 && elemento.offsetHeight > 0) {
                        // Verificar se o elemento contém texto relevante
                        const textoElemento = elemento.textContent?.toLowerCase() || '';
                        const ariaLabel = elemento.getAttribute('aria-label')?.toLowerCase() || '';
                        
                        if (textoElemento.includes('avançar') || textoElemento.includes('next') ||
                            ariaLabel.includes('avançar') || ariaLabel.includes('next')) {
                            botaoEncontrado = elemento;
                            console.log(`[Content Script] Botão "Avançar" encontrado com seletor: ${seletor}`);
                            console.log(`[Content Script] Texto do botão: "${textoElemento}", Aria-label: "${ariaLabel}"`);
                            break;
                        }
                    }
                }
                if (botaoEncontrado) break;
            } catch (e) {
                console.warn(`[Content Script] Erro com seletor ${seletor}:`, e.message);
            }
        }
        
        // Se não encontrou com seletores específicos, procurar por texto
        if (!botaoEncontrado) {
            console.log('[Content Script] Seletores específicos falharam, procurando por texto...');
            
            const todosElementosClicaveis = document.querySelectorAll(
                'div[role="button"], button, span[role="button"], a[role="button"]'
            );
            
            const textosAvancar = ['avançar', 'next', 'continuar', 'continue', 'prosseguir', 'proceed'];
            
            for (const elemento of todosElementosClicaveis) {
                if (elemento.offsetParent === null || elemento.offsetWidth === 0 || elemento.offsetHeight === 0) {
                    continue;
                }
                
                const textoElemento = elemento.textContent?.toLowerCase().trim() || '';
                const ariaLabel = elemento.getAttribute('aria-label')?.toLowerCase() || '';
                
                // Verificar se contém palavras-chave de avançar
                const contemTextoAvancar = textosAvancar.some(texto => 
                    textoElemento.includes(texto) || ariaLabel.includes(texto)
                );
                
                if (contemTextoAvancar) {
                    botaoEncontrado = elemento;
                    console.log(`[Content Script] Botão "Avançar" encontrado por texto: "${textoElemento}" / "${ariaLabel}"`);
                    break;
                }
            }
        }
        
        // Se ainda não encontrou, tentar botões em posições típicas (último botão visível)
        if (!botaoEncontrado) {
            console.log('[Content Script] Procurando último botão visível como fallback...');
            
            const botoesVisiveis = Array.from(document.querySelectorAll('div[role="button"], button'))
                .filter(btn => btn.offsetParent !== null && btn.offsetWidth > 0 && btn.offsetHeight > 0)
                .filter(btn => !btn.disabled); // Filtrar botões desabilitados
            
            if (botoesVisiveis.length > 0) {
                // Pegar o último botão visível (geralmente é o botão de ação principal)
                const ultimoBotao = botoesVisiveis[botoesVisiveis.length - 1];
                const textoUltimo = ultimoBotao.textContent?.toLowerCase().trim() || '';
                const ariaLabelUltimo = ultimoBotao.getAttribute('aria-label')?.toLowerCase() || '';
                
                console.log(`[Content Script] Último botão visível: "${textoUltimo}" / "${ariaLabelUltimo}"`);
                
                // Se o último botão não contém texto negativo, assumir que é o de avançar
                const textosNegativos = ['cancelar', 'cancel', 'voltar', 'back', 'fechar', 'close'];
                const temTextoNegativo = textosNegativos.some(texto => 
                    textoUltimo.includes(texto) || ariaLabelUltimo.includes(texto)
                );
                
                if (!temTextoNegativo && textoUltimo.length > 0) {
                    botaoEncontrado = ultimoBotao;
                    console.log(`[Content Script] Usando último botão como "Avançar": "${textoUltimo}"`);
                }
            }
        }

        if (botaoEncontrado) {
            console.log('[Content Script] Botão "Avançar" encontrado! Preparando para clicar...');
            
            try {
                // Scroll para garantir que está visível
                botaoEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Tentar diferentes métodos de clique
                console.log('[Content Script] Tentando clique nativo...');
                botaoEncontrado.click();
                
                // Aguardar e verificar se a ação foi bem-sucedida
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Verificar se ainda estamos na mesma etapa ou se avançou
                const mesmoElementoAindaPresente = document.contains(botaoEncontrado) && 
                    botaoEncontrado.offsetParent !== null;
                
                if (!mesmoElementoAindaPresente) {
                    console.log('[Content Script] ✅ Botão "Avançar" clicado com sucesso! Página avançou.');
                    return true;
                } else {
                    console.log('[Content Script] ⚠️ Botão ainda presente, tentando clique com evento...');
                    
                    // Fallback: tentar com MouseEvent
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    botaoEncontrado.dispatchEvent(clickEvent);
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const elementoAindaPresente = document.contains(botaoEncontrado) && 
                        botaoEncontrado.offsetParent !== null;
                    
                    if (!elementoAindaPresente) {
                        console.log('[Content Script] ✅ Botão "Avançar" clicado com sucesso via evento!');
                        return true;
                    } else {
                        console.log('[Content Script] ⚠️ Clique não teve efeito, continuando busca...');
                    }
                }
                
            } catch (error) {
                console.error('[Content Script] Erro ao clicar no botão:', error);
            }
        } else {
            console.log(`[Content Script] Tentativa ${tentativa}: botão "Avançar" ainda não encontrado. Aguardando...`);
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.error('[Content Script] ❌ Falha ao encontrar ou clicar no botão "Avançar" após timeout');
    
    // Debug: mostrar todos os botões disponíveis
    console.log('[Content Script] === DEBUG: Todos os botões disponíveis na página ===');
    const todosBotoes = document.querySelectorAll('div[role="button"], button, span[role="button"]');
    todosBotoes.forEach((botao, index) => {
        if (botao.offsetParent !== null) {
            console.log(`[Content Script] Botão ${index + 1}:`, {
                tag: botao.tagName,
                role: botao.getAttribute('role'),
                ariaLabel: botao.getAttribute('aria-label'),
                texto: botao.textContent?.trim().substring(0, 50),
                classes: botao.className.substring(0, 100)
            });
        }
    });
    
    return false;
}

// Função de detecção automática de grupos removida
// A detecção de grupos agora deve ser feita manualmente pelo usuário

// Função de seleção automática de grupos removida
// A seleção de grupos agora deve ser feita manualmente pelo usuário

async function clicarBotaoPublicar(postData = null) {
    console.log("[Content Script] 🚀 Procurando botão 'Publicar'...");

    // Seletores mais abrangentes para o botão de publicar
    const seletores = [
        'div[role="button"][aria-label="Publicar"]',
        'div[role="button"][aria-label="Publish"]',
        'button[aria-label="Publicar"]',
        'button[aria-label="Publish"]',
        'div[data-testid="marketplace-composer-publish-button"]',
        'button[data-testid="marketplace-composer-publish-button"]',
        'div[role="button"][aria-label="Publicar anúncio"]',
        'div[role="button"][aria-label="Publish listing"]',
        'button[aria-label="Postar"]',
        'button[aria-label="Post"]',
        'div[role="button"][aria-label="Publicar no Marketplace"]',
        'button[aria-label="Publicar no Marketplace"]'
    ];

    // Debug: listar todos os botões disponíveis na página
    console.log("[Content Script] 🔍 Debug - Listando todos os botões na página:");
    const todosBotoes = document.querySelectorAll('button, div[role="button"], span[role="button"]');
    todosBotoes.forEach((botao, index) => {
        if (botao.offsetParent !== null) { // Apenas botões visíveis
            const texto = botao.textContent || botao.getAttribute('aria-label') || '';
            const classes = botao.className || '';
            console.log(`[Content Script] Botão ${index + 1}: "${texto}" | Classes: ${classes}`);
        }
    });

    for (let tentativa = 1; tentativa <= 20; tentativa++) {
        console.log(`[Content Script] 🔄 Tentativa ${tentativa}/20 de encontrar botão Publicar...`);
        
        let botao = null;
        let seletorUsado = '';
        
        // Tentar todos os seletores
        for (const seletor of seletores) {
            botao = document.querySelector(seletor);
            if (botao && botao.offsetParent !== null) {
                seletorUsado = seletor;
                console.log(`[Content Script] ✅ Botão encontrado com seletor: ${seletor}`);
                break;
            }
        }
        
        // Se não encontrou com seletores, procurar por texto
        if (!botao) {
            console.log("[Content Script] 🔍 Procurando botão por texto...");
            const elementos = document.querySelectorAll('button, div[role="button"], span[role="button"]');
            const textosPublicar = [
                'Publicar', 'Publish', 'Postar', 'Post', 'Publicar anúncio',
                'Publish listing', 'Publicar no Marketplace', 'Concluir'
            ];
            
            for (const elemento of elementos) {
                if (elemento.offsetParent === null) continue;
                const texto = elemento.textContent || elemento.getAttribute('aria-label') || '';
                
                if (textosPublicar.some(t => texto.toLowerCase().trim() === t.toLowerCase().trim())) {
                    botao = elemento;
                    seletorUsado = `texto: "${texto}"`;
                    console.log(`[Content Script] ✅ Botão encontrado por texto exato: "${texto}"`);
                    break;
                }
            }
            
            // Se ainda não encontrou, procurar por texto parcial
            if (!botao) {
            for (const elemento of elementos) {
                if (elemento.offsetParent === null) continue;
                const texto = elemento.textContent || elemento.getAttribute('aria-label') || '';
                
                if (textosPublicar.some(t => texto.toLowerCase().includes(t.toLowerCase()))) {
                    botao = elemento;
                        seletorUsado = `texto parcial: "${texto}"`;
                        console.log(`[Content Script] ✅ Botão encontrado por texto parcial: "${texto}"`);
                    break;
                    }
                }
            }
        }
        
        if (botao) {
            console.log(`[Content Script] 🎯 Botão encontrado na tentativa ${tentativa} (${seletorUsado}), preparando para clicar...`);
            
            try {
                // Verificar se o botão está habilitado
                const isDisabled = botao.hasAttribute('disabled') || 
                                 botao.getAttribute('aria-disabled') === 'true' ||
                                 botao.classList.contains('disabled');
                
                if (isDisabled) {
                    console.log(`[Content Script] ⚠️ Botão está desabilitado, aguardando ficar disponível...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                // Scroll para garantir que o botão está visível
                console.log("[Content Script] 📍 Fazendo scroll para o botão...");
                botao.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Verificar se ainda está visível após scroll
                if (botao.offsetParent === null) {
                    console.log("[Content Script] ⚠️ Botão não está mais visível após scroll");
                    continue;
                }
                
                // Clicar no botão
                console.log("[Content Script] 👆 Clicando no botão...");
                botao.click();
                
                // Aguardar alguns segundos e verificar se a publicação foi bem-sucedida
                console.log("[Content Script] ⏳ Aguardando confirmação da publicação...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Verificar se apareceu mensagem de sucesso ou se saiu da página de criação
                const sucesso = await verificarPublicacaoSucesso();
                
                if (sucesso) {
                    console.log("[Content Script] ✅ Publicação confirmada com sucesso!");
                    
                    // Verificar se devemos postar nos grupos baseado no targetType
                    console.log("[Content Script] 🔍 Verificando targetType:", postData?.targetType);
                    
                    // Só postar nos grupos se targetType for "both" (ambos) ou "groups"
                    if (postData?.targetType === 'both' || postData?.targetType === 'groups') {
                        // Verificar se postagem automática nos grupos está ativada
                        try {
                            const settings = await new Promise((resolve) => {
                                chrome.storage.local.get(['settings'], (result) => {
                                    resolve(result.settings || { autoPostToGroups: true });
                                });
                            });
                            
                            if (settings.autoPostToGroups) {
                                console.log("[Content Script] 🎯 Iniciando postagem automática nos grupos...");
                                await postarNosGrupos();
                            } else {
                                console.log("[Content Script] ℹ️ Postagem automática nos grupos está desativada");
                            }
                        } catch (error) {
                            console.error("[Content Script] ❌ Erro durante postagem nos grupos:", error);
                        }
                    } else {
                        console.log(`[Content Script] ℹ️ Pulando postagem nos grupos - targetType: ${postData?.targetType || 'marketplace'}`);
                    }
                    
                    return true;
                } else {
                    console.warn("[Content Script] ⚠️ Clique executado mas publicação não confirmada, tentando novamente...");
                }
            } catch (error) {
                console.error(`[Content Script] ❌ Erro ao clicar no botão na tentativa ${tentativa}:`, error);
            }
        } else {
            console.log(`[Content Script] ⏳ Tentativa ${tentativa}: nenhum botão de publicar encontrado. Aguardando...`);
            
            // Debug adicional: mostrar URL atual
            console.log(`[Content Script] 🔍 URL atual: ${window.location.href}`);
            
            // Debug adicional: verificar se estamos na página certa
            if (!window.location.href.includes('marketplace') && !window.location.href.includes('sell')) {
                console.warn("[Content Script] ⚠️ Não parece estar na página do marketplace!");
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.error("[Content Script] ❌ Não foi possível publicar após 20 tentativas");
    console.log("[Content Script] 🔍 Debug final - URL:", window.location.href);
    console.log("[Content Script] 🔍 Debug final - Botões visíveis:", 
        document.querySelectorAll('button, div[role="button"]').length);
    
    return false;
}

// Nova função para verificar se a publicação foi bem-sucedida
async function verificarPublicacaoSucesso() {
    console.log("[Content Script] 🔍 Verificando sinais de publicação bem-sucedida...");
    
    // Aguardar um tempo inicial para a página processar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Múltiplas verificações em tentativas
    for (let tentativa = 1; tentativa <= 10; tentativa++) {
        console.log(`[Content Script] 🔍 Tentativa ${tentativa} de verificação de sucesso...`);
        
        // 1. Verificar notificações de sucesso
        const notificacoesSucesso = await verificarNotificacoesSucesso();
        if (notificacoesSucesso) {
            console.log("[Content Script] ✅ Sucesso detectado via notificações!");
            return true;
        }
        
        // 2. Verificar se saiu da página de criação (redirecionamento)
        const url = window.location.href;
        console.log(`[Content Script] 🔍 URL atual: ${url}`);
        if (!url.includes('/marketplace/create') && 
            !url.includes('/sell') && 
            !url.includes('/selling') &&
            !url.includes('/composer')) {
            console.log("[Content Script] ✅ Saiu da página de criação - assumindo sucesso");
            return true;
        }
        
        // 3. Verificar se o botão "Publicar" sumiu ou mudou
        const resultadoBotao = await verificarEstadoBotaoPublicar();
        if (resultadoBotao.sucesso) {
            console.log(`[Content Script] ✅ ${resultadoBotao.motivo}`);
            return true;
        }
        
        // 4. Verificar mensagens de sucesso em elementos específicos
        const mensagensSucesso = await verificarMensagensSucesso();
        if (mensagensSucesso) {
            console.log("[Content Script] ✅ Sucesso detectado via mensagens!");
            return true;
        }
        
        // 5. Verificar se há elementos indicativos de página pós-publicação
        const paginaPostPublicacao = await verificarPaginaPostPublicacao();
        if (paginaPostPublicacao) {
            console.log("[Content Script] ✅ Sucesso detectado - página pós-publicação!");
            return true;
        }
        
        console.log(`[Content Script] ⏳ Tentativa ${tentativa}: ainda não detectou sucesso, aguardando...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log("[Content Script] ⚠️ Nenhum sinal claro de sucesso detectado após 10 tentativas");
    return false;
}

// Função auxiliar para verificar notificações de sucesso
async function verificarNotificacoesSucesso() {
    const seletoresNotificacao = [
        'div[role="alert"]',
        'div[data-testid="toast"]',
        '.notification',
        '.toast',
        'div[role="status"]'
    ];
    
    const mensagensSucesso = [
        'publicado', 'published', 'anúncio', 'listing', 'sucesso', 'success',
        'criado', 'created', 'compartilhado', 'shared', 'postado', 'posted'
    ];
    
    for (const seletor of seletoresNotificacao) {
        const elementos = document.querySelectorAll(seletor);
        for (const elemento of elementos) {
            const texto = (elemento.textContent || '').toLowerCase();
            if (mensagensSucesso.some(msg => texto.includes(msg))) {
                console.log(`[Content Script] ✅ Notificação de sucesso encontrada: "${elemento.textContent}"`);
                return true;
            }
        }
    }
    
    return false;
}

// Função auxiliar para verificar estado do botão publicar
async function verificarEstadoBotaoPublicar() {
    const seletoresBotao = [
        'div[role="button"][aria-label="Publicar"]',
        'button[aria-label="Publicar"]',
        'div[role="button"][aria-label="Publish"]',
        'button[aria-label="Publish"]',
        'div[role="button"][aria-label="Postar"]',
        'button[aria-label="Postar"]',
        'div[data-testid="marketplace-composer-publish-button"]',
        'button[data-testid="marketplace-composer-publish-button"]'
    ];
    
    // Verificar se o botão sumiu
    let botaoEncontrado = false;
    for (const seletor of seletoresBotao) {
        const botao = document.querySelector(seletor);
        if (botao && botao.offsetParent !== null) {
            botaoEncontrado = true;
            
            // Verificar se está desabilitado ou carregando
            const disabled = botao.getAttribute('disabled') !== null;
            const loading = botao.querySelector('svg') || botao.textContent.includes('...');
            
            if (disabled || loading) {
                console.log("[Content Script] 🔄 Botão está processando...");
                return { sucesso: false, motivo: "Processando" };
            }
            
            break;
        }
    }
    
    if (!botaoEncontrado) {
        return { sucesso: true, motivo: "Botão 'Publicar' não está mais presente - assumindo sucesso" };
    }
    
    return { sucesso: false, motivo: "Botão ainda presente" };
}

// Função auxiliar para verificar mensagens de sucesso
async function verificarMensagensSucesso() {
    const seletoresMensagem = [
        'div[role="main"]',
        'div[data-pagelet="root"]',
        '.composer',
        'form',
        'main'
    ];
    
    const mensagensSucesso = [
        'anúncio publicado', 'listing published', 'post published',
        'publicado com sucesso', 'successfully published',
        'seu anúncio foi publicado', 'your listing has been published',
        'anúncio criado', 'listing created', 'publicação realizada',
        'compartilhado', 'shared', 'postado', 'posted'
    ];
    
    for (const seletor of seletoresMensagem) {
        const container = document.querySelector(seletor);
        if (container) {
            const texto = (container.textContent || '').toLowerCase();
            
            for (const mensagem of mensagensSucesso) {
                if (texto.includes(mensagem.toLowerCase())) {
                console.log(`[Content Script] ✅ Mensagem de sucesso encontrada: "${mensagem}"`);
                return true;
                }
            }
        }
    }
    
    return false;
}

// Função auxiliar para verificar página pós-publicação
async function verificarPaginaPostPublicacao() {
    const indicadoresPosPublicacao = [
        // Elementos que aparecem após publicação
        'div[role="button"]',
        'button'
    ];
    
    const textosPosPublicacao = [
        'ver anúncio', 'view listing', 'compartilhar', 'share',
        'editar', 'edit', 'promover', 'boost', 'impulsionar'
    ];
    
    for (const seletor of indicadoresPosPublicacao) {
        const elementos = document.querySelectorAll(seletor);
        for (const elemento of elementos) {
            if (elemento.offsetParent === null) continue;
            
            const texto = (elemento.textContent || elemento.getAttribute('aria-label') || '').toLowerCase();
            
            if (textosPosPublicacao.some(t => texto.includes(t))) {
                console.log(`[Content Script] ✅ Elemento pós-publicação encontrado: "${texto}"`);
        return true;
            }
        }
    }
    
    return false;
}

// Função principal para postar nos grupos após publicação
async function postarNosGrupos() {
    console.log("[Content Script] 🎯 Iniciando processo de postagem nos grupos...");
    
    try {
        // Aguardar um pouco para garantir que a publicação foi processada
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Passo 1: Clicar nos 3 pontinhos
        const cliqueTresPontinhosRealizado = await clicarTresPontinhos();
        if (!cliqueTresPontinhosRealizado) {
            console.error("[Content Script] ❌ Não foi possível clicar nos 3 pontinhos");
            return false;
        }
        
        // Aguardar o menu aparecer
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Passo 2: Clicar em "Anunciar em Mais Locais"
        const cliqueAnunciarRealizado = await clicarAnunciarMaisLocais();
        if (!cliqueAnunciarRealizado) {
            console.error("[Content Script] ❌ Não foi possível clicar em 'Anunciar em Mais Locais'");
            return false;
        }
        
        // Aguardar a página dos grupos carregar
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Passo 3: Selecionar os grupos disponíveis
        const gruposSelecionados = await selecionarGruposDisponiveis();
        console.log(`[Content Script] ✅ Processo concluído! ${gruposSelecionados} grupos selecionados.`);
        
        return true;
        
    } catch (error) {
        console.error("[Content Script] ❌ Erro durante processo de postagem nos grupos:", error);
        return false;
    }
}

// Função para clicar nos 3 pontinhos do anúncio
async function clicarTresPontinhos() {
    console.log("[Content Script] Procurando botão dos 3 pontinhos...");
    
    const seletor = 'div[role="none"].x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1qhmfi1.x1r1pt67.x7at6mh.xkde5i4';
    
    for (let tentativa = 1; tentativa <= 15; tentativa++) {
        console.log(`[Content Script] Tentativa ${tentativa} de encontrar os 3 pontinhos...`);
        
        const elemento = document.querySelector(seletor);
        
        if (elemento && elemento.offsetParent !== null) {
            console.log("[Content Script] ✅ 3 pontinhos encontrados, clicando...");
            
            try {
                // Scroll para garantir que está visível
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Clicar
                elemento.click();
                
                console.log("[Content Script] ✅ Clique nos 3 pontinhos realizado!");
                return true;
                
            } catch (error) {
                console.error(`[Content Script] Erro ao clicar nos 3 pontinhos na tentativa ${tentativa}:`, error);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.error("[Content Script] ❌ Não foi possível encontrar/clicar nos 3 pontinhos após 15 tentativas");
    return false;
}

// Função para clicar em "Anunciar em Mais Locais"
async function clicarAnunciarMaisLocais() {
    console.log("[Content Script] Procurando opção 'Anunciar em Mais Locais'...");
    
    // Seletor do span específico fornecido pelo usuário
    const seletorSpanEspecifico = 'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xk50ysn.xzsf02u.x1yc453h[dir="auto"]';
    
    // Debug: listar todos os itens de menu e spans disponíveis
    console.log("[Content Script] 🔍 Debug - Listando todos os itens de menu:");
    const todosMenuItems = document.querySelectorAll('div[role="menuitem"]');
    todosMenuItems.forEach((item, index) => {
        const texto = item.textContent?.trim() || '';
        const classes = item.className || '';
        const spanInterno = item.querySelector('span[dir="auto"]');
        const textoSpan = spanInterno?.textContent?.trim() || '';
        console.log(`[Content Script] Menu ${index + 1}: "${texto}" | Span interno: "${textoSpan}" | Classes: ${classes.substring(0, 100)}...`);
    });
    
    // Debug adicional: verificar se o span específico existe
    const spanEspecifico = document.querySelector(seletorSpanEspecifico);
    console.log(`[Content Script] 🔍 Span específico encontrado: ${!!spanEspecifico}`, spanEspecifico ? {
        texto: spanEspecifico.textContent?.trim(),
        visivel: spanEspecifico.offsetParent !== null,
        paiMenuitem: !!spanEspecifico.closest('div[role="menuitem"]')
    } : null);
    
    for (let tentativa = 1; tentativa <= 10; tentativa++) {
        console.log(`[Content Script] Tentativa ${tentativa} de encontrar 'Anunciar em Mais Locais'...`);
        
        let elemento = null;
        let metodoEncontrado = '';
        
        // Método 1: Procurar pelo span específico e depois encontrar o menuitem pai
        const spanEncontrado = document.querySelector(seletorSpanEspecifico);
        if (spanEncontrado && spanEncontrado.offsetParent !== null) {
            // Encontrar o elemento pai que tem role="menuitem"
            let elementoPai = spanEncontrado.closest('div[role="menuitem"]');
            if (elementoPai) {
                elemento = elementoPai;
                metodoEncontrado = 'span específico + menuitem pai';
                console.log("[Content Script] ✅ Elemento encontrado pelo span específico e menuitem pai");
            }
        }
        
        // Método 2: Se não encontrou, procurar por texto específico primeiro
        if (!elemento) {
            const elementosMenu = document.querySelectorAll('div[role="menuitem"]');
            
            for (const menuItem of elementosMenu) {
                const textoCompleto = menuItem.textContent?.trim() || '';
                const textoSpan = menuItem.querySelector('span')?.textContent?.trim() || '';
                
                console.log(`[Content Script] Verificando item: "${textoCompleto}" | Span: "${textoSpan}"`);
                
                // Buscar especificamente por "Anunciar em mais locais"
                if (textoCompleto.toLowerCase().includes('anunciar em mais locais') || 
                    textoSpan.toLowerCase().includes('anunciar em mais locais')) {
                    elemento = menuItem;
                    metodoEncontrado = `texto: "${textoCompleto || textoSpan}"`;
                    console.log(`[Content Script] ✅ Elemento encontrado por texto: "${textoCompleto || textoSpan}"`);
                    break;
                }
            }
        }
        
        // Método 3: Fallback para outros textos em inglês/português
        if (!elemento) {
            const elementosMenu = document.querySelectorAll('div[role="menuitem"]');
            const textosEsperados = [
                'share to more places',
                'compartilhar em mais locais',
                'cross-post'
            ];
            
            for (const menuItem of elementosMenu) {
                const texto = (menuItem.textContent || '').toLowerCase().trim();
                
                if (textosEsperados.some(t => texto.includes(t))) {
                    elemento = menuItem;
                    metodoEncontrado = `texto alternativo: "${texto}"`;
                    console.log(`[Content Script] ✅ Elemento encontrado por texto alternativo: "${texto}"`);
                    break;
                }
            }
        }
        
        if (elemento && elemento.offsetParent !== null) {
            console.log(`[Content Script] ✅ 'Anunciar em Mais Locais' encontrado via ${metodoEncontrado}, clicando...`);
            
            try {
                // Scroll para garantir que está visível
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Clicar
                elemento.click();
                
                console.log("[Content Script] ✅ Clique em 'Anunciar em Mais Locais' realizado!");
                return true;
                
            } catch (error) {
                console.error(`[Content Script] Erro ao clicar em 'Anunciar em Mais Locais' na tentativa ${tentativa}:`, error);
            }
        } else {
            console.log(`[Content Script] ⏳ Tentativa ${tentativa}: 'Anunciar em Mais Locais' não encontrado`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.error("[Content Script] ❌ Não foi possível encontrar/clicar em 'Anunciar em Mais Locais' após 10 tentativas");
    console.log("[Content Script] 🔍 Itens de menu disponíveis no momento:");
    const menuFinal = document.querySelectorAll('div[role="menuitem"]');
    menuFinal.forEach((item, index) => {
        console.log(`  ${index + 1}. "${item.textContent?.trim()}"`);
    });
    
    return false;
}

// Função para selecionar os grupos disponíveis (ignorando sugestões)
async function selecionarGruposDisponiveis() {
    console.log("[Content Script] Procurando grupos disponíveis para seleção...");
    
    // Aguardar a página carregar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const seletorCheckbox = 'div[role="checkbox"].x1i10hfl.x1qjc9v5.xjbqb8w.xjqpnuy.xc5r6h4.xqeqjp1.x1phubyo.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1ypdohk.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x14z9mp.xat24cr.x1lziwak.x2lwn1j.xeuugli.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1n2onr6.x16tdsg8.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1fmog5m.xu25z0z.x140muxe.xo1y3bh.x1q0g3np.x87ps6o.x1lku1pv.x1a2a7pz.x1lliihq';
    
    let gruposSelecionados = 0;
    let tentativas = 0;
    const maxTentativas = 5;
    
    while (tentativas < maxTentativas) {
        tentativas++;
        console.log(`[Content Script] Tentativa ${tentativas} de selecionar grupos...`);
        
        // Buscar todos os checkboxes de grupos disponíveis
        const checkboxes = document.querySelectorAll(seletorCheckbox);
        console.log(`[Content Script] Encontrados ${checkboxes.length} checkboxes de grupos`);
        
        if (checkboxes.length === 0) {
            console.log("[Content Script] Nenhum checkbox encontrado, aguardando página carregar...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }
        
        for (let i = 0; i < checkboxes.length; i++) {
            const checkbox = checkboxes[i];
            
            // Verificar se não está marcado (aria-checked="false")
            const isChecked = checkbox.getAttribute('aria-checked') === 'true';
            
            if (!isChecked && checkbox.offsetParent !== null) {
                try {
                    console.log(`[Content Script] Selecionando grupo ${i + 1}...`);
                    
                    // Scroll para garantir que está visível
                    checkbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Clicar no checkbox
                    checkbox.click();
                    gruposSelecionados++;
                    
                    console.log(`[Content Script] ✅ Grupo ${i + 1} selecionado!`);
                    
                    // Pequena pausa entre seleções
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`[Content Script] Erro ao selecionar grupo ${i + 1}:`, error);
                }
            }
        }
        
        // Se selecionou pelo menos um grupo, considerar sucesso
        if (gruposSelecionados > 0) {
            break;
        }
        
        console.log("[Content Script] Nenhum grupo foi selecionado, tentando novamente...");
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (gruposSelecionados > 0) {
        console.log(`[Content Script] ✅ Processo concluído! ${gruposSelecionados} grupos selecionados.`);
        
        // Opcional: Procurar e clicar em botão de confirmar/postar se existir
        await procurarBotaoConfirmarGrupos();
    } else {
        console.warn("[Content Script] ⚠️ Nenhum grupo foi selecionado");
    }
    
    return gruposSelecionados;
}

// Função auxiliar para procurar botão de confirmar após selecionar grupos
async function procurarBotaoConfirmarGrupos() {
    console.log("[Content Script] Procurando botão para confirmar seleção de grupos...");
    
    // Implementação avançada para detectar e clicar no botão "Postar"
    return new Promise((resolve) => {
        console.log('[Content Script] Iniciando detecção avançada do botão "Postar"...');
        
        // Seletores específicos para o botão "Postar"
        const seletores = [
            'div[role="button"][aria-label="Postar"]',
            'button[aria-label="Postar"]',
            'div[role="button"]:not([aria-disabled="true"]):not(.disabled):not([style*="display: none"]):not([style*="visibility: hidden"]):not([style*="opacity: 0"])',
            'button:not([disabled]):not([aria-disabled="true"]):not(.disabled):not([style*="display: none"]):not([style*="visibility: hidden"]):not([style*="opacity: 0"])'
        ];
        
        // Função para verificar se o elemento está visível
        function isVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0
            );
        }
        
        // Função para verificar se o elemento está habilitado
        function isEnabled(el) {
            return !el.disabled && 
                   el.getAttribute('aria-disabled') !== 'true' && 
                   !el.classList.contains('disabled');
        }
        
        // Função para tentar clicar no botão usando seletores específicos
        function tryClickSpecificButton() {
            for (const selector of seletores) {
                const buttons = document.querySelectorAll(selector);
                console.log(`[Content Script] Verificando seletor: ${selector} - Encontrados: ${buttons.length}`);
                
                for (const button of buttons) {
                    // Verificar se o texto do botão é "Postar" ou "Publicar"
                    const buttonText = button.textContent.trim();
                    if ((buttonText === 'Postar' || buttonText === 'Publicar') && 
                        isVisible(button) && isEnabled(button)) {
                        
                        // Destacar visualmente para debug
                        button.style.border = '3px solid red';
                        button.style.boxShadow = '0 0 10px red';
                        
                        try {
                            console.log(`[Content Script] ✅ Botão "${buttonText}" encontrado e clicando...`);
                            button.click();
                            console.log(`[Content Script] ✅ Botão "${buttonText}" clicado com sucesso!`);
                            resolve(true);
                            return true;
                        } catch (error) {
                            console.error(`[Content Script] Erro ao clicar no botão "${buttonText}":`, error);
                        }
                    }
                }
            }
            
            // Busca genérica por botões com texto "Postar" ou "Publicar"
            const allButtons = document.querySelectorAll('button, div[role="button"]');
            for (const button of allButtons) {
                if (!isVisible(button) || !isEnabled(button)) continue;
                
                const buttonText = button.textContent.trim();
                if (buttonText === 'Postar' || buttonText === 'Publicar') {
                    // Destacar visualmente para debug
                    button.style.border = '3px solid orange';
                    button.style.boxShadow = '0 0 10px orange';
                    
                    try {
                        console.log(`[Content Script] ✅ Botão "${buttonText}" encontrado por texto e clicando...`);
                        button.click();
                        console.log(`[Content Script] ✅ Botão "${buttonText}" clicado com sucesso!`);
                        resolve(true);
                        return true;
                    } catch (error) {
                        console.error(`[Content Script] Erro ao clicar no botão "${buttonText}":`, error);
                    }
                }
            }
            
            return false;
        }
        
        // Tenta clicar imediatamente (se já carregado)
        if (!tryClickSpecificButton()) {
            // Contador de tentativas
            let tentativas = 0;
            const maxTentativas = 5;
            
            // Intervalo para tentar periodicamente (caso o MutationObserver não detecte)
            const intervalId = setInterval(() => {
                tentativas++;
                console.log(`[Content Script] Tentativa ${tentativas} de encontrar botão "Postar"...`);
                
                if (tryClickSpecificButton() || tentativas >= maxTentativas) {
                    clearInterval(intervalId);
                    if (tentativas >= maxTentativas && !observer.disconnect) {
                        console.log("[Content Script] ℹ️ Botão 'Postar' não encontrado após várias tentativas");
                        resolve(false);
                    }
                }
            }, 1000);
            
            // Usa MutationObserver para observar mudanças no DOM (Facebook é dinâmico)
            const observer = new MutationObserver(() => {
                if (tryClickSpecificButton()) {
                    clearInterval(intervalId);
                    observer.disconnect();
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            console.log('[Content Script] Observando o DOM para detectar o botão "Postar"...');
        }
    });
}

// Função de debug para diagnosticar problemas de publicação
function debugPublicacao() {
    console.log("🔧 === DEBUG PUBLICAÇÃO ===");
    console.log("📍 URL atual:", window.location.href);
    console.log("📍 Title:", document.title);
    
    // Listar todos os botões visíveis
    const botoes = document.querySelectorAll('button, div[role="button"], span[role="button"]');
    console.log(`📍 Total de botões na página: ${botoes.length}`);
    
    const botoesVisiveis = Array.from(botoes).filter(b => b.offsetParent !== null);
    console.log(`📍 Botões visíveis: ${botoesVisiveis.length}`);
    
    botoesVisiveis.forEach((botao, index) => {
        const texto = botao.textContent || botao.getAttribute('aria-label') || '';
        const classes = botao.className || 'sem-classes';
        const disabled = botao.hasAttribute('disabled') || botao.getAttribute('aria-disabled') === 'true';
        console.log(`  ${index + 1}. "${texto}" | Disabled: ${disabled} | Classes: ${classes.substring(0, 50)}...`);
    });
    
    // Verificar notificações
    const notificacoes = document.querySelectorAll('div[role="alert"], div[role="status"], .notification, .toast');
    console.log(`📍 Notificações encontradas: ${notificacoes.length}`);
    notificacoes.forEach((notif, index) => {
        console.log(`  ${index + 1}. "${notif.textContent}"`);
    });
    
    // Verificar mensagens de sucesso na página
    const textoCompleto = document.body.textContent.toLowerCase();
    const palavrasChave = ['publicado', 'published', 'sucesso', 'success', 'criado', 'created'];
    const palavrasEncontradas = palavrasChave.filter(palavra => textoCompleto.includes(palavra));
    console.log("📍 Palavras-chave encontradas na página:", palavrasEncontradas);
    
    console.log("🔧 === FIM DEBUG ===");
}

// Função manual para testar detecção de sucesso
async function testarDeteccaoSucesso() {
    console.log("🧪 === TESTE DETECÇÃO DE SUCESSO ===");
    
    console.log("🔍 Testando verificarNotificacoesSucesso...");
    const notificacoes = await verificarNotificacoesSucesso();
    console.log("✅ Resultado notificações:", notificacoes);
    
    console.log("🔍 Testando verificarEstadoBotaoPublicar...");
    const botao = await verificarEstadoBotaoPublicar();
    console.log("✅ Resultado botão:", botao);
    
    console.log("🔍 Testando verificarMensagensSucesso...");
    const mensagens = await verificarMensagensSucesso();
    console.log("✅ Resultado mensagens:", mensagens);
    
    console.log("🔍 Testando verificarPaginaPostPublicacao...");
    const posPublicacao = await verificarPaginaPostPublicacao();
    console.log("✅ Resultado pós-publicação:", posPublicacao);
    
    console.log("🔍 Testando verificarPublicacaoSucesso completa...");
    const sucessoCompleto = await verificarPublicacaoSucesso();
    console.log("✅ Resultado sucesso completo:", sucessoCompleto);
    
    console.log("🧪 === FIM TESTE ===");
}

// Função de debug para testar upload de imagens
function debugUploadImagens() {
    console.log("🖼️ === DEBUG UPLOAD DE IMAGENS ===");
    
    // Verificar se há inputs de arquivo
    const inputsFile = document.querySelectorAll('input[type="file"]');
    console.log(`📍 Inputs de arquivo encontrados: ${inputsFile.length}`);
    
    inputsFile.forEach((input, index) => {
        console.log(`  ${index + 1}. Accept: "${input.accept}" | Multiple: ${input.multiple} | Visível: ${input.offsetParent !== null}`);
    });
    
    // Verificar especificamente inputs de imagem
    const inputsImagem = document.querySelectorAll('input[type="file"][accept*="image"]');
    console.log(`📍 Inputs específicos de imagem: ${inputsImagem.length}`);
    
    // Verificar se estamos na página correta
    const url = window.location.href;
    console.log(`📍 URL atual: ${url}`);
    console.log(`📍 É página do Marketplace: ${url.includes('marketplace')}`);
    
    console.log("🖼️ === FIM DEBUG ===");
}

// Função de debug para menu dos 3 pontinhos
function debugMenuTresPontinhos() {
    console.log("⚙️ === DEBUG MENU 3 PONTINHOS ===");
    
    // Verificar se o menu está aberto
    const menuItems = document.querySelectorAll('div[role="menuitem"]');
    console.log(`📍 Itens de menu encontrados: ${menuItems.length}`);
    
    if (menuItems.length > 0) {
        console.log("📍 Detalhes dos itens de menu:");
        menuItems.forEach((item, index) => {
            const texto = item.textContent?.trim() || '';
            const span = item.querySelector('span')?.textContent?.trim() || '';
            const spanComDir = item.querySelector('span[dir="auto"]')?.textContent?.trim() || '';
            const classes = item.className || '';
            const visivel = item.offsetParent !== null;
            
            console.log(`  ${index + 1}. Texto: "${texto}"`);
            console.log(`      Span: "${span}"`);
            console.log(`      Span[dir="auto"]: "${spanComDir}"`);
            console.log(`      Visível: ${visivel}`);
            console.log(`      Classes: ${classes.substring(0, 80)}...`);
            console.log(`      ---`);
        });
        
        // Verificar se existe o span específico para "Anunciar em mais locais"
        const seletorSpan = 'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xk50ysn.xzsf02u.x1yc453h[dir="auto"]';
        const spanAnunciar = document.querySelector(seletorSpan);
        console.log("📍 Span específico 'Anunciar em mais locais':", {
            encontrado: !!spanAnunciar,
            texto: spanAnunciar?.textContent?.trim(),
            temPaiMenuitem: !!spanAnunciar?.closest('div[role="menuitem"]')
        });
    } else {
        console.log("❌ Nenhum item de menu encontrado. O menu pode não estar aberto.");
        
        // Verificar se há botões de 3 pontinhos
        const botoesTresPontinhos = document.querySelectorAll('div[role="none"]');
        console.log(`📍 Elementos com role="none": ${botoesTresPontinhos.length}`);
        
        const seletorTresPontinhos = 'div[role="none"].x1ja2u2z.x78zum5.x2lah0s.x1n2onr6.xl56j7k.x6s0dn4.xozqiw3.x1q0g3np.x14ldlfn.x1b1wa69.xws8118.x5fzff1.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.x1qhmfi1.x1r1pt67.x7at6mh.xkde5i4';
        const botaoEspecifico = document.querySelector(seletorTresPontinhos);
        console.log(`📍 Botão 3 pontinhos específico encontrado: ${!!botaoEspecifico}`);
    }
    
    console.log("⚙️ === FIM DEBUG ===");
}

// Função de debug para verificar imagens antes do upload
function debugImagensRecebidas(images) {
    console.log("🖼️ === DEBUG IMAGENS RECEBIDAS ===");
    console.log(`📍 Total de imagens: ${images?.length || 0}`);
    
    if (!images || images.length === 0) {
        console.log("❌ Nenhuma imagem recebida");
        return;
    }
    
    // Análise de duplicatas
    const nomes = images.map(img => img?.name).filter(Boolean);
    const nomesUnicos = [...new Set(nomes)];
    console.log(`📍 Nomes únicos: ${nomesUnicos.length} de ${nomes.length} total`);
    
    if (nomesUnicos.length !== nomes.length) {
        console.warn("⚠️ DUPLICATAS DETECTADAS!");
        const contadores = {};
        nomes.forEach(nome => {
            contadores[nome] = (contadores[nome] || 0) + 1;
        });
        
        Object.entries(contadores).forEach(([nome, count]) => {
            if (count > 1) {
                console.warn(`  - "${nome}": ${count} vezes`);
            }
        });
    }
    
    // Detalhes de cada imagem
    images.forEach((img, index) => {
        console.log(`📍 Imagem ${index + 1}:`, {
            name: img?.name,
            size: img?.size,
            dataUrlLength: img?.dataUrl?.length,
            type: img?.type,
            hasDataUrl: !!img?.dataUrl
        });
    });
    
    console.log("🖼️ === FIM DEBUG ===");
}

// Adicionar funções ao escopo global para poder chamar no console
window.debugPublicacao = debugPublicacao;
window.testarDeteccaoSucesso = testarDeteccaoSucesso;
window.verificarPublicacaoSucesso = verificarPublicacaoSucesso;
window.debugUploadImagens = debugUploadImagens;
window.debugMenuTresPontinhos = debugMenuTresPontinhos;
window.debugImagensRecebidas = debugImagensRecebidas;
window.postarNosGrupos = postarNosGrupos;
window.clicarTresPontinhos = clicarTresPontinhos;
window.clicarAnunciarMaisLocais = clicarAnunciarMaisLocais;

console.log("🔧 Funções de debug disponíveis:");
console.log("  - debugPublicacao() - Mostra estado atual da página");
console.log("  - testarDeteccaoSucesso() - Testa todas as verificações de sucesso");
console.log("  - verificarPublicacaoSucesso() - Testa apenas a função principal");
console.log("  - debugUploadImagens() - Diagnóstica problemas com upload de imagens");
console.log("  - debugMenuTresPontinhos() - Diagnóstica menu dos 3 pontinhos");
console.log("  - debugImagensRecebidas(images) - Analisa duplicatas em array de imagens");
console.log("  - postarNosGrupos() - Testa processo completo de postagem nos grupos");
console.log("  - clicarTresPontinhos() - Testa apenas clique nos 3 pontinhos");
console.log("  - clicarAnunciarMaisLocais() - Testa apenas clique em 'Anunciar em Mais Locais'");

// Fim do artefato// Fim do artefato
