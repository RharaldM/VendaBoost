#!/usr/bin/env python3
"""
Session Deduplicator - Sistema profissional de deduplicação de sessões JSON
Mantém apenas a versão mais recente de cada ID único de sessão
"""

import json
import os
import time
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict
import signal
import threading

class SessionDeduplicator:
    """Gerenciador de deduplicação de arquivos de sessão JSON"""
    
    def __init__(self, sessions_dir: str = None):
        """
        Inicializa o deduplicador de sessões
        
        Args:
            sessions_dir: Diretório contendo os arquivos de sessão
        """
        self.sessions_dir = Path(sessions_dir) if sessions_dir else Path.cwd()
        self.excluded_files = {'current-session.json', 'active-session-config.json'}
        self.running = True
        self.setup_logging()
        
    def setup_logging(self):
        """Configura o sistema de logging profissional"""
        log_dir = Path.cwd() / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        log_file = log_dir / f'session_deduplicator_{datetime.now().strftime("%Y%m%d")}.log'
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(self.__class__.__name__)
        
    def get_session_info(self, file_path: Path) -> Tuple[str, datetime]:
        """
        Extrai o ID da sessão e timestamp de um arquivo JSON
        
        Args:
            file_path: Caminho do arquivo JSON
            
        Returns:
            Tupla (session_id, timestamp) ou (None, None) se houver erro
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Tenta diferentes campos possíveis para o ID da sessão
            session_id = (
                data.get('activeSessionId') or
                data.get('sessionId') or
                data.get('id') or
                data.get('accountId')
            )
            
            # Tenta diferentes campos possíveis para timestamp
            timestamp_str = (
                data.get('updatedAt') or
                data.get('timestamp') or
                data.get('createdAt')
            )
            
            if not session_id:
                self.logger.warning(f"Arquivo {file_path.name} não possui ID de sessão válido")
                return None, None
                
            # Converte timestamp para datetime
            if timestamp_str:
                # Remove microsegundos extras se necessário
                if '.' in timestamp_str:
                    base, frac = timestamp_str.split('.')
                    frac = frac.rstrip('Z')[:6] + 'Z'
                    timestamp_str = f"{base}.{frac}"
                    
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                # Usa o tempo de modificação do arquivo como fallback
                timestamp = datetime.fromtimestamp(file_path.stat().st_mtime)
                
            return session_id, timestamp
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Erro ao decodificar JSON em {file_path.name}: {e}")
        except Exception as e:
            self.logger.error(f"Erro ao processar {file_path.name}: {e}")
            
        return None, None
        
    def scan_and_deduplicate(self):
        """Escaneia o diretório e remove duplicatas mantendo apenas as mais recentes"""
        try:
            if not self.sessions_dir.exists():
                self.logger.error(f"Diretório {self.sessions_dir} não existe")
                return
                
            # Mapeia IDs para listas de arquivos com seus timestamps
            session_map: Dict[str, List[Tuple[Path, datetime]]] = defaultdict(list)
            
            # Coleta todos os arquivos JSON válidos
            json_files = [f for f in self.sessions_dir.glob('*.json') 
                         if f.name not in self.excluded_files]
            
            if not json_files:
                self.logger.info("Nenhum arquivo de sessão encontrado para processar")
                return
                
            self.logger.info(f"Analisando {len(json_files)} arquivo(s) de sessão...")
            
            # Processa cada arquivo
            for file_path in json_files:
                session_id, timestamp = self.get_session_info(file_path)
                
                if session_id and timestamp:
                    session_map[session_id].append((file_path, timestamp))
                    
            # Remove duplicatas mantendo apenas o mais recente
            total_removed = 0
            for session_id, files in session_map.items():
                if len(files) > 1:
                    # Ordena por timestamp (mais recente primeiro)
                    files.sort(key=lambda x: x[1], reverse=True)
                    
                    # Mantém o mais recente e remove os outros
                    newest = files[0]
                    self.logger.info(f"ID '{session_id}': mantendo {newest[0].name} (mais recente)")
                    
                    for file_path, timestamp in files[1:]:
                        try:
                            file_path.unlink()
                            total_removed += 1
                            self.logger.info(f"  ✓ Removido: {file_path.name} ({timestamp.isoformat()})")
                        except Exception as e:
                            self.logger.error(f"  ✗ Erro ao remover {file_path.name}: {e}")
                            
            # Relatório final
            unique_sessions = len(session_map)
            if total_removed > 0:
                self.logger.info(f"\n=== RESUMO DA DEDUPLICAÇÃO ===")
                self.logger.info(f"Sessões únicas encontradas: {unique_sessions}")
                self.logger.info(f"Arquivos duplicados removidos: {total_removed}")
                self.logger.info(f"===============================\n")
            else:
                self.logger.info(f"Nenhuma duplicata encontrada. {unique_sessions} sessão(ões) única(s) mantida(s).")
                
        except Exception as e:
            self.logger.error(f"Erro durante a deduplicação: {e}", exc_info=True)
            
    def run_periodic_check(self, interval_minutes: int = 5):
        """
        Executa verificações periódicas de deduplicação
        
        Args:
            interval_minutes: Intervalo entre verificações em minutos
        """
        interval_seconds = interval_minutes * 60
        self.logger.info(f"Iniciando monitoramento contínuo (intervalo: {interval_minutes} minutos)")
        self.logger.info(f"Diretório monitorado: {self.sessions_dir}")
        self.logger.info("Pressione Ctrl+C para parar\n")
        
        # Executa primeira verificação imediatamente
        self.logger.info("=== Executando verificação inicial ===")
        self.scan_and_deduplicate()
        
        # Loop principal
        while self.running:
            try:
                # Aguarda o intervalo ou sinal de parada
                for _ in range(interval_seconds):
                    if not self.running:
                        break
                    time.sleep(1)
                    
                if self.running:
                    self.logger.info(f"\n=== Verificação periódica ({datetime.now().strftime('%H:%M:%S')}) ===")
                    self.scan_and_deduplicate()
                    
            except KeyboardInterrupt:
                self.stop()
                break
                
    def stop(self):
        """Para o monitoramento"""
        self.running = False
        self.logger.info("\n\nParando monitoramento...")
        
def signal_handler(signum, frame):
    """Handler para sinais de interrupção"""
    sys.exit(0)
    
def main():
    """Função principal"""
    # Configura handler de sinais
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)
    
    # Permite configuração customizada via argumentos
    import argparse
    parser = argparse.ArgumentParser(description='Session Deduplicator - Remove arquivos de sessão duplicados')
    parser.add_argument(
        '--dir', 
        type=str, 
        help='Diretório contendo os arquivos de sessão',
        default=None
    )
    parser.add_argument(
        '--interval', 
        type=int, 
        default=5,
        help='Intervalo entre verificações em minutos (padrão: 5)'
    )
    parser.add_argument(
        '--once',
        action='store_true',
        help='Executa apenas uma vez e sai (sem loop)'
    )
    
    args = parser.parse_args()
    
    # Cria e executa o deduplicador
    deduplicator = SessionDeduplicator(sessions_dir=args.dir)
    
    if args.once:
        deduplicator.logger.info("Modo de execução única")
        deduplicator.scan_and_deduplicate()
    else:
        try:
            deduplicator.run_periodic_check(interval_minutes=args.interval)
        except KeyboardInterrupt:
            deduplicator.stop()
            
    deduplicator.logger.info("Deduplicador finalizado.")
    
if __name__ == "__main__":
    main()