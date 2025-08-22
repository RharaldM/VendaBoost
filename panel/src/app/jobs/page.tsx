'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Search, Filter, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

// Mock data para demonstração
const mockJobs = [
  {
    id: 'job-001',
    type: 'marketplace.publish',
    status: 'completed',
    listing: {
      title: 'iPhone 13 Pro Max 256GB',
      price: 'R$ 3.500,00',
      category: 'electronics',
    },
    createdAt: new Date('2024-01-15T10:30:00'),
    completedAt: new Date('2024-01-15T10:32:15'),
    duration: 135000, // ms
  },
  {
    id: 'job-002',
    type: 'marketplace.publish',
    status: 'running',
    listing: {
      title: 'MacBook Air M2',
      price: 'R$ 7.200,00',
      category: 'electronics',
    },
    createdAt: new Date('2024-01-15T11:15:00'),
    completedAt: null,
    duration: null,
  },
  {
    id: 'job-003',
    type: 'marketplace.publish',
    status: 'failed',
    listing: {
      title: 'Bicicleta Speed',
      price: 'R$ 1.200,00',
      category: 'sports',
    },
    createdAt: new Date('2024-01-15T09:45:00'),
    completedAt: new Date('2024-01-15T09:46:30'),
    duration: 90000,
    error: 'Erro de autenticação',
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500">Concluído</Badge>;
    case 'running':
      return <Badge className="bg-blue-500">Em Execução</Badge>;
    case 'failed':
      return <Badge variant="destructive">Falhou</Badge>;
    case 'pending':
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

export default function JobsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Filtrar jobs baseado nos filtros
  const filteredJobs = mockJobs.filter((job) => {
    const matchesSearch = job.listing.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesType = typeFilter === 'all' || job.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            Histórico e status dos jobs de automação
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="running">Em Execução</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="marketplace.publish">Marketplace</SelectItem>
                <SelectItem value="groups.publish">Grupos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum job encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Ainda não há jobs criados'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{job.listing.title}</h3>
                      {getStatusBadge(job.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Preço:</span> {job.listing.price}
                      </div>
                      <div>
                        <span className="font-medium">Categoria:</span> {job.listing.category}
                      </div>
                      <div>
                        <span className="font-medium">Criado:</span>{' '}
                        {job.createdAt.toLocaleString('pt-BR')}
                      </div>
                      <div>
                        <span className="font-medium">Duração:</span>{' '}
                        {job.status === 'running' ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Em execução...
                          </span>
                        ) : (
                          formatDuration(job.duration)
                        )}
                      </div>
                    </div>
                    
                    {job.error && (
                      <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                        <strong>Erro:</strong> {job.error}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{mockJobs.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {mockJobs.filter(j => j.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Concluídos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {mockJobs.filter(j => j.status === 'running').length}
              </div>
              <div className="text-sm text-muted-foreground">Em Execução</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {mockJobs.filter(j => j.status === 'failed').length}
              </div>
              <div className="text-sm text-muted-foreground">Falharam</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}