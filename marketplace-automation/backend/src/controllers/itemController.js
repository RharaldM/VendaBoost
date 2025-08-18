const MarketplaceService = require('../services/MarketplaceService');
const path = require('path');
const fs = require('fs');

/**
 * Controller para operações de itens do Marketplace
 */
class ItemController {
  constructor() {
    this.marketplaceService = null;
  }

  /**
   * Agenda um item para publicação no Marketplace
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  scheduleItem = async (req, res) => {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      logManager.addLog('info', '📋 Nova solicitação de agendamento recebida');
      
      // Validar dados de entrada
      const validationResult = this.validateItemData(req.body, req.files);
      if (!validationResult.isValid) {
        logManager.addLog('error', '❌ Dados inválidos', { errors: validationResult.errors });
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: validationResult.errors
        });
      }

      const { title, description, price, category } = req.body;
      const photos = req.files ? req.files.map(file => file.path) : [];

      logManager.addLog('info', '✅ Dados validados com sucesso', {
        title,
        price,
        category,
        photosCount: photos.length
      });

      // Inicializar serviço do Marketplace
      this.marketplaceService = new MarketplaceService(logManager);

      // Executar automação de forma assíncrona
      this.executeAutomation({
        title,
        description,
        price,
        category,
        photos
      }).catch(error => {
        logManager.addLog('error', '❌ Erro na automação assíncrona', { error: error.message });
      });

      // Resposta imediata para o cliente
      res.json({
        success: true,
        message: 'Item agendado para publicação. Acompanhe o progresso via logs em tempo real.',
        data: {
          title,
          price,
          category,
          photosCount: photos.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro interno no agendamento', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Executa a automação do Marketplace
   * @param {Object} itemData - Dados do item
   */
  async executeAutomation(itemData) {
    const logManager = global.logManager;
    
    try {
      logManager.addLog('info', '🤖 Iniciando automação do Marketplace...');
      
      // Inicializar navegador
      await this.marketplaceService.initializeBrowser();
      
      // Fazer login
      const loginSuccess = await this.marketplaceService.loginToFacebook();
      if (!loginSuccess) {
        throw new Error('Falha no login do Facebook');
      }
      
      // Navegar para o Marketplace
      const navigationSuccess = await this.marketplaceService.navigateToMarketplace();
      if (!navigationSuccess) {
        throw new Error('Falha ao navegar para o Marketplace');
      }
      
      // Postar item
      const result = await this.marketplaceService.postMarketplaceItem(itemData);
      
      logManager.addLog('success', '🎉 Automação concluída com sucesso!', result);
      
    } catch (error) {
      logManager.addLog('error', '❌ Erro na automação', { 
        error: error.message,
        stack: error.stack
      });
    } finally {
      // Sempre fechar o navegador
      if (this.marketplaceService) {
        await this.marketplaceService.closeBrowser();
      }
    }
  }

  /**
   * Valida os dados do item
   * @param {Object} body - Dados do corpo da requisição
   * @param {Array} files - Arquivos enviados
   * @returns {Object} Resultado da validação
   */
  validateItemData(body, files) {
    const errors = [];
    
    // Validar título
    if (!body.title || body.title.trim().length === 0) {
      errors.push('Título é obrigatório');
    } else if (body.title.length > 100) {
      errors.push('Título deve ter no máximo 100 caracteres');
    }
    
    // Validar preço
    if (body.price) {
      const price = parseFloat(body.price);
      if (isNaN(price) || price < 0) {
        errors.push('Preço deve ser um número válido e positivo');
      }
    }
    
    // Validar descrição
    if (body.description && body.description.length > 1000) {
      errors.push('Descrição deve ter no máximo 1000 caracteres');
    }
    
    // Validar fotos
    if (files && files.length > 10) {
      errors.push('Máximo de 10 fotos permitidas');
    }
    
    // Validar tipos de arquivo
    if (files) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = files.filter(file => !allowedTypes.includes(file.mimetype));
      
      if (invalidFiles.length > 0) {
        errors.push('Apenas arquivos de imagem são permitidos (JPEG, PNG, WebP)');
      }
      
      // Validar tamanho dos arquivos (5MB por arquivo)
      const maxSize = 5 * 1024 * 1024; // 5MB
      const oversizedFiles = files.filter(file => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        errors.push('Cada imagem deve ter no máximo 5MB');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Obtém o status da automação
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  getAutomationStatus = async (req, res) => {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      const stats = logManager.getLogStats();
      const connectedClients = socketService.getClientCount();
      
      res.json({
        success: true,
        data: {
          logStats: stats,
          connectedClients,
          isAutomationRunning: this.marketplaceService !== null,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao obter status', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Cancela a automação em execução
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  cancelAutomation = async (req, res) => {
    try {
      const logManager = global.logManager;
      
      if (this.marketplaceService) {
        await this.marketplaceService.closeBrowser();
        this.marketplaceService = null;
        
        logManager.addLog('warning', '⚠️ Automação cancelada pelo usuário');
        
        res.json({
          success: true,
          message: 'Automação cancelada com sucesso'
        });
      } else {
        res.json({
          success: false,
          message: 'Nenhuma automação em execução'
        });
      }
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao cancelar automação', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = ItemController;