/**
 * Módulo de internacionalização com regex multilíngue
 * Suporta português (BR), inglês e espanhol
 */

export const t = {
  // Botões principais do Facebook
  buttons: {
    // Botão para criar anúncio/listing
    createListing: /Criar anúncio|Create (listing|ad)|Crear anuncio|Publicar|Publish|Vender algo|Sell something|Vender algo/i,
    
    // Botão para anunciar em mais locais/grupos
    postToMorePlaces: /Anunciar mais locais|Post to more places|Publicar en más lugares|Compartilhar em grupos|Share to groups|Compartir en grupos/i,
    
    // Botão de publicar/postar
    publish: /Publicar|Postar|Publish|Post|Publicar ahora|Enviar|Send|Confirmar|Confirm/i,
    
    // Botão de salvar/guardar
    save: /Salvar|Save|Guardar|Aplicar|Apply|Concluído|Done|Finalizar|Finish/i,
    
    // Botão de próximo/continuar
    next: /Próximo|Next|Siguiente|Continuar|Continue|Avançar|Advance/i,
    
    // Botão de voltar/anterior
    back: /Voltar|Back|Anterior|Previous|Atrás/i,
    
    // Botão de fechar/cancelar
    close: /Fechar|Close|Cerrar|Cancelar|Cancel|Sair|Exit/i,
    
    // Botão de adicionar fotos
    addPhotos: /Adicionar fotos|Add photos|Agregar fotos|Carregar fotos|Upload photos|Subir fotos/i,
  },

  // Labels e placeholders de campos
  labels: {
    // Campo de título do anúncio
    title: /Título|Title|Título del anuncio|Nome do item|Item name|Nombre del artículo|O que você está vendendo|What are you selling|Qué estás vendiendo/i,
    
    // Campo de preço
    price: /Preço|Price|Precio|Valor|Value|Custo|Cost|Costo/i,
    
    // Campo de descrição
    description: /Descrição|Description|Descripción|Detalhes|Details|Detalles|Conte mais sobre|Tell us more|Cuéntanos más/i,
    
    // Campo de busca de grupos
    groupSearch: /Pesquisar|Search|Buscar|Procurar grupos|Search groups|Buscar grupos|Encontrar grupos|Find groups/i,
    
    // Campo de categoria
    category: /Categoria|Category|Categoría|Tipo|Type|Classificação|Classification/i,
    
    // Campo de condição do item
    condition: /Condição|Condition|Condición|Estado|State|Status/i,
    
    // Campo de localização
    location: /Localização|Location|Ubicación|Local|Place|Lugar|Endereço|Address|Dirección/i,
  },

  // Textos de confirmação e status
  texts: {
    // Confirmação de publicação
    published: /Publicado|publicado|Published|published|Publicado con éxito|Anúncio criado|Ad created|Anuncio creado|Seu anúncio foi publicado|Your ad has been published|Tu anuncio ha sido publicado/i,
    
    // Post publicado
    postPublished: /Post publicado|Post published|Publicación publicada|Anúncio publicado|Ad published|Anuncio publicado/i,
    
    // Anúncio criado
    listingCreated: /Anúncio criado|Listing created|Anuncio creado|Item criado|Item created|Artículo creado/i,
    
    // Publicação bem-sucedida
    publishSuccess: /Publicação bem-sucedida|Publish success|Publicación exitosa|Publicado com sucesso|Published successfully|Publicado exitosamente/i,
    
    // Texto de sucesso
    success: /Sucesso|Success|Éxito|Concluído|Completed|Completado|Finalizado|Finished|Terminado/i,
    
    // Texto de erro
    error: /Erro|Error|Error|Falha|Failed|Falló|Problema|Problem|Problema/i,
    
    // Texto de carregamento
    loading: /Carregando|Loading|Cargando|Aguarde|Wait|Espera|Processando|Processing|Procesando/i,
    
    // Texto de grupos selecionados
    groupsSelected: /grupos selecionados|groups selected|grupos seleccionados|selecionado|selected|seleccionado/i,
  },

  // Opções de condição do item
  conditions: {
    new: /Novo|New|Nuevo|Nunca usado|Never used|Nunca usado/i,
    likeNew: /Como novo|Like new|Como nuevo|Quase novo|Almost new|Casi nuevo/i,
    good: /Bom|Good|Bueno|Bom estado|Good condition|Buen estado/i,
    fair: /Regular|Fair|Regular|Estado regular|Fair condition|Condición regular/i,
    poor: /Ruim|Poor|Malo|Estado ruim|Poor condition|Mal estado/i,
  },

  // Categorias comuns
  categories: {
    electronics: /Eletrônicos|Electronics|Electrónicos|Tecnologia|Technology|Tecnología/i,
    vehicles: /Veículos|Vehicles|Vehículos|Carros|Cars|Coches|Motos|Motorcycles|Motocicletas/i,
    clothing: /Roupas|Clothing|Ropa|Vestuário|Apparel|Vestimenta/i,
    home: /Casa|Home|Hogar|Móveis|Furniture|Muebles|Decoração|Decoration|Decoración/i,
    sports: /Esportes|Sports|Deportes|Fitness|Academia|Gym|Ginasio/i,
  },

  // Mensagens de erro comuns
  errors: {
    required: /obrigatório|required|requerido|necessário|necessary|necesario/i,
    invalid: /inválido|invalid|inválido|incorreto|incorrect|incorrecto/i,
    tooShort: /muito curto|too short|muy corto|mínimo|minimum|mínimo/i,
    tooLong: /muito longo|too long|muy largo|máximo|maximum|máximo/i,
    networkError: /erro de rede|network error|error de red|conexão|connection|conexión|internet/i,
    validationError: /erro de validação|validation error|error de validación|dados inválidos|invalid data|datos inválidos/i,
    publishFailed: /(?:publish failed|publicação falhou|publicación falló|failed to publish|falha na publicação)/i,
  },

  // Elementos de interface
  ui: {
    // Modal/dialog
    modal: /modal|dialog|popup|janela|window|ventana/i,
    
    // Checkbox
    checkbox: /checkbox|caixa de seleção|casilla de verificación/i,
    
    // Radio button
    radio: /radio|opção|option|opción/i,
    
    // Dropdown/select
    dropdown: /dropdown|select|lista|list|lista desplegable/i,
    
    // Tooltip
    tooltip: /tooltip|dica|tip|consejo|ajuda|help|ayuda/i,
  }
};

/**
 * Função utilitária para escapar caracteres especiais em regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Função para criar regex case-insensitive a partir de texto
 */
export function createRegex(text: string, flags: string = 'i'): RegExp {
  return new RegExp(escapeRegex(text), flags);
}

/**
 * Função para verificar se um texto corresponde a alguma das regex de um grupo
 */
export function matchesAny(text: string, regexGroup: RegExp[]): boolean {
  return regexGroup.some(regex => regex.test(text));
}

/**
 * Função para encontrar o primeiro elemento que corresponde a qualquer regex do grupo
 */
export function findByAnyRegex(elements: string[], regexGroup: RegExp[]): string | undefined {
  return elements.find(element => matchesAny(element, regexGroup));
}

/**
 * Mapeamento de idiomas para códigos
 */
export const languageCodes = {
  'pt': 'português',
  'pt-BR': 'português brasileiro',
  'en': 'english',
  'en-US': 'english (US)',
  'es': 'español',
  'es-ES': 'español (España)',
  'es-MX': 'español (México)',
} as const;

/**
 * Detecta o idioma provável baseado no texto
 */
export function detectLanguage(text: string): keyof typeof languageCodes | 'unknown' {
  const lowerText = text.toLowerCase();
  
  // Palavras características de cada idioma
  const patterns = {
    'pt-BR': /\b(você|está|são|não|sim|com|para|por|mais|muito|bem|bom|boa)\b/,
    'en': /\b(you|are|is|not|yes|with|for|by|more|very|well|good)\b/,
    'es': /\b(usted|está|son|no|sí|con|para|por|más|muy|bien|bueno|buena)\b/,
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowerText)) {
      return lang as keyof typeof languageCodes;
    }
  }
  
  return 'unknown';
}