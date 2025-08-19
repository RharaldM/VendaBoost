import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Schema para validação dos dados do fluxo de publicação
 */
export const FlowSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  price: z.union([
    z.string().min(1, 'Preço não pode estar vazio'),
    z.number().positive('Preço deve ser positivo')
  ]),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  images: z.array(z.string()).default([]).optional(),
  groups: z.array(z.string()).default([]).optional(),
});

export type FlowInput = z.infer<typeof FlowSchema>;

/**
 * Schema para configurações da aplicação
 */
export const AppConfig = z.object({
  userDataDir: z.string().default(
    process.env.USER_DATA_DIR || '.user-profiles/default'
  ),
  startUrl: z.string().url().default(
    process.env.FB_START_URL || 'https://www.facebook.com/marketplace/create/item'
  ),
  throttleMs: z.coerce.number().min(100).max(5000).default(
    Number(process.env.THROTTLE_MS || 350)
  ),
  debug: z.boolean().default(
    process.env.DEBUG === 'true'
  ),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default(
    (process.env.LOG_LEVEL as any) || 'debug'
  ),
});

export type AppCfg = z.infer<typeof AppConfig>;

/**
 * Carrega e valida dados do fluxo a partir de um arquivo JSON
 */
export function loadFlow(file?: string): FlowInput {
  if (!file) {
    throw new Error('Passe --flow caminho/arquivo.json');
  }

  const resolvedPath = path.resolve(file);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo não encontrado: ${resolvedPath}`);
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const json = JSON.parse(raw);
    return FlowSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`Dados inválidos no arquivo ${file}: ${issues}`);
    }
    throw new Error(`Erro ao ler arquivo ${file}: ${error}`);
  }
}

/**
 * Carrega e valida configurações da aplicação
 */
export function loadAppConfig(): AppCfg {
  try {
    return AppConfig.parse({});
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`Configuração inválida: ${issues}`);
    }
    throw error;
  }
}

/**
 * Cria um arquivo de exemplo de fluxo
 */
export function createExampleFlow(outputPath: string): void {
  const example: FlowInput = {
    title: "Notebook Gamer RTX 3060 - 16GB RAM",
    price: 4200,
    description: "Notebook gamer em ótimo estado, RTX 3060, 512GB SSD, acompanha carregador original. Ideal para jogos e trabalho pesado.",
    images: ["./fotos/1.jpg", "./fotos/2.jpg"],
    groups: [
      "Compra e Venda Cidade X",
      "Classificados da Região Y", 
      "Ofertas Cidade Z"
    ]
  };

  fs.writeFileSync(outputPath, JSON.stringify(example, null, 2), 'utf-8');
}