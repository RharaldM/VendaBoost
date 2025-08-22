'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { bridgeQueries, bridgeMutations } from '@/lib/bridgeClient';
import { listingSchema } from '@/lib/types';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import React from 'react';
import SessionSelector from '@/components/SessionSelector';
import { useSession } from '@/contexts/SessionContext';

type ListingFormData = z.infer<typeof listingSchema>;

export default function PublishPage() {
  const router = useRouter();
  const { activeSession: selectedSession } = useSession();
  
  const { data: sessions } = useQuery(bridgeQueries.sessions());

  const uploadImagesMutation = useMutation(bridgeMutations.uploadImages());
  const createJobMutation = useMutation(bridgeMutations.createJob());

  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  
  const form = useForm({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      category: '',
      condition: 'new' as const,
      location: '',
      images: [] as string[],
    },
  });

  const onSubmit = async (data: ListingFormData) => {
    if (!selectedSession) {
      toast.error('Selecione uma sessão do Facebook antes de publicar.');
      return;
    }

    if (!selectedSession.isValid) {
      toast.error('A sessão selecionada está expirada. Selecione uma sessão válida.');
      return;
    }

    try {
      // Usar a sessão selecionada
      const fbUserId = selectedSession.userId;
      
      // Sem grupos por enquanto - apenas criação do anúncio
      const groups: string[] = [];
      
      // Preparar dados do listing
      const listingData = { ...data };
      
      // Se há imagens selecionadas, fazer upload primeiro
      if (selectedFiles.length > 0) {
        toast.info('Fazendo upload das imagens...');
        
        const uploadResult = await uploadImagesMutation.mutateAsync(selectedFiles);
        
        if (uploadResult.success) {
          // Usar os caminhos dos arquivos enviados
          listingData.images = uploadResult.files.map(file => file.path);
          toast.success(`${uploadResult.files.length} imagens enviadas com sucesso!`);
        } else {
          throw new Error('Falha no upload das imagens');
        }
      }
      
      const result = await createJobMutation.mutateAsync({
        fbUserId,
        listing: listingData,
        groups
      });

      toast.success('Job de publicação criado com sucesso!');
      router.push(`/jobs/${result.id}`);
    } catch (error) {
      console.error('Erro ao criar job:', error);
      toast.error('Erro ao criar job de publicação');
    }
  };

  const isSubmitting = createJobMutation.isPending || uploadImagesMutation.isPending;
  const hasActiveSessions = sessions && sessions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Publicar Anúncio</h1>
        <p className="text-muted-foreground">
          Crie um novo anúncio para o Facebook Marketplace
        </p>
      </div>

      {/* Session Selector */}
      <SessionSelector />

      {/* Publish Form */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Anúncio</CardTitle>
          <CardDescription>
            Preencha as informações do produto que será publicado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                 control={form.control}
                 name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: iPhone 13 Pro Max 256GB"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                 control={form.control}
                 name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ex: 3500"
                          min="0"
                          step="0.01"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                 control={form.control}
                 name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o produto em detalhes..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Seja detalhado para atrair mais compradores
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                   control={form.control}
                   name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="electronics">Eletrônicos</SelectItem>
                          <SelectItem value="vehicles">Veículos</SelectItem>
                          <SelectItem value="home">Casa e Jardim</SelectItem>
                          <SelectItem value="clothing">Roupas e Acessórios</SelectItem>
                          <SelectItem value="sports">Esportes</SelectItem>
                          <SelectItem value="books">Livros</SelectItem>
                          <SelectItem value="tools">Ferramentas</SelectItem>
                          <SelectItem value="other">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                   control={form.control}
                   name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condição *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a condição" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="used_like_new">Usado - Como Novo</SelectItem>
                          <SelectItem value="used_good">Usado - Bom Estado</SelectItem>
                          <SelectItem value="used_fair">Usado - Estado Regular</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                   control={form.control}
                   name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: São Paulo, São Paulo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagens</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setSelectedFiles(files);
                          const filePaths = files.map(file => file.name);
                          field.onChange(filePaths);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Selecione até 10 imagens do produto (JPG, PNG, WEBP)
                    </FormDescription>
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 text-sm text-green-600">
                        {selectedFiles.length} arquivo(s) selecionado(s): {selectedFiles.map(f => f.name).join(', ')}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={isSubmitting}
                >
                  Limpar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !hasActiveSessions}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Publicar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}