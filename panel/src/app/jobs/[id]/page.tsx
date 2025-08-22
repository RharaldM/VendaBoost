'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { bridgeQueries } from '@/lib/bridgeClient';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Calendar, User, Package, RefreshCw, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LogStream } from '@/components/LogStream';

// Mock data para demonstração
const mockJobDetails = {
  'job-001': {
    id: 'job-001',
    type: 'marketplace.publish',
    status: 'completed',
    listing: {
      title: 'iPhone 13 Pro Max 256GB',
      description: 'iPhone 13 Pro Max em excelente estado, 256GB de armazenamento, cor azul sierra. Acompanha carregador original e caixa.',
      price: 'R$ 3.500,00',
      category: 'electronics',
      condition: 'used_like_new',
      location: 'São Paulo, SP',
    },
    createdAt: new Date('2024-01-15T10:30:00'),
    startedAt: new Date('2024-01-15T10:30:15'),
    completedAt: new Date('2024-01-15T10:32:15'),
    duration: 135000,
    result: {
      success: true,
      marketplaceUrl: 'https://facebook.com/marketplace/item/123456789',
      publishedAt: new Date('2024-01-15T10:32:10'),
    },
  },
  'job-002': {
    id: 'job-002',
    type: 'marketplace.publish',
    status: 'running',
    listing: {
      title: 'MacBook Air M2',
      description: 'MacBook Air com chip M2, 8GB RAM, 256GB SSD. Usado por apenas 6 meses, em perfeito estado.',
      price: 'R$ 7.200,00',
      category: 'electronics',
      condition: 'used_like_new',
      location: 'Rio de Janeiro, RJ',
    },
    createdAt: new Date('2024-01-15T11:15:00'),
    startedAt: new Date('2024-01-15T11:15:30'),
    completedAt: null,
    duration: null,
  },
  'job-003': {
    id: 'job-003',
    type: 'marketplace.publish',
    status: 'failed',
    listing: {
      title: 'Bicicleta Speed',
      description: 'Bicicleta speed profissional, quadro de alumínio, 21 marchas.',
      price: 'R$ 1.200,00',
      category: 'sports',
      condition: 'used_good',
      location: 'Belo Horizonte, MG',
    },
    createdAt: new Date('2024-01-15T09:45:00'),
    startedAt: new Date('2024-01-15T09:45:15'),
    completedAt: new Date('2024-01-15T09:46:30'),
    duration: 90000,
    error: 'Erro de autenticação: Sessão do Facebook expirou',
  },
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'pending':
    case 'queued':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return <Badge className="bg-green-500">Concluído</Badge>;
    case 'running':
      return <Badge className="bg-blue-500">Em Execução</Badge>;
    case 'failed':
      return <Badge variant="destructive">Falhou</Badge>;
    case 'pending':
    case 'queued':
      return <Badge variant="secondary">Pendente</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(ms: number | null) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function getConditionLabel(condition: string) {
  const conditions: Record<string, string> = {
    'new': 'Novo',
    'used_like_new': 'Usado - Como Novo',
    'used_good': 'Usado - Bom Estado',
    'used_fair': 'Usado - Estado Regular',
  };
  return conditions[condition] || condition;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  // Buscar job real do bridge
  const { data: job, isLoading, error } = useQuery(bridgeQueries.jobStatus(jobId));
  
  // Para demonstração, usamos dados mock (desabilitado):
  // const job = mockJobDetails[jobId as keyof typeof mockJobDetails];
  // const isLoading = false;
  // const error = null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando detalhes do job...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Job não encontrado</h3>
          <p className="text-muted-foreground mb-4">
            O job solicitado não foi encontrado ou não existe.
          </p>
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Jobs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/jobs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job {job.id}</h1>
            <p className="text-muted-foreground">
              Detalhes da automação de publicação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(job.status)}
          {getStatusBadge(job.status)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Job Info */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Status e Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Criado em:</span>
                  <p>{new Date(job.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                {job.startedAt && (
                  <div>
                    <span className="font-medium text-muted-foreground">Iniciado em:</span>
                    <p>{new Date(job.startedAt).toLocaleString('pt-BR')}</p>
                  </div>
                )}
                {job.completedAt && (
                  <div>
                    <span className="font-medium text-muted-foreground">Concluído em:</span>
                    <p>{new Date(job.completedAt).toLocaleString('pt-BR')}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-muted-foreground">Duração:</span>
                  <p>
                    {job.status === 'running' ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 animate-pulse" />
                        Em execução...
                      </span>
                    ) : (
                      formatDuration(job.duration)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listing Details */}
          {job.listing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Detalhes do Anúncio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{job.listing.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{job.listing.description}</p>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Preço:</span>
                    <p className="font-semibold text-lg text-green-600">R$ {job.listing.price}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Categoria:</span>
                    <p className="capitalize">{job.listing.category}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Condição:</span>
                    <p>{getConditionLabel(job.listing.condition)}</p>
                  </div>
                  {job.listing.location && (
                    <div>
                      <span className="font-medium text-muted-foreground">Localização:</span>
                      <p>{job.listing.location}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result/Error */}
          {job.status === 'succeeded' && job.result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Resultado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Anúncio publicado com sucesso!
                  </p>
                  {job.result.marketplaceUrl && (
                    <div>
                      <span className="font-medium text-muted-foreground text-sm">URL do Marketplace:</span>
                      <p>
                        <a 
                          href={job.result.marketplaceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {job.result.marketplaceUrl}
                        </a>
                      </p>
                    </div>
                  )}
                  {job.result.publishedAt && (
                    <div>
                      <span className="font-medium text-muted-foreground text-sm">Publicado em:</span>
                      <p className="text-sm">{new Date(job.result.publishedAt).toLocaleString('pt-BR')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {job.status === 'failed' && job.error && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Erro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                  {job.error}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Logs */}
        <div>
          <LogStream jobId={job.id} />
        </div>
      </div>
    </div>
  );
}