// Sistema centralizado de erros com mensagens didáticas
export const ProjectErrors = {
  // ==========================================
  // ERROS DE PERMISSÃO
  // ==========================================
  PERMISSION_NOT_LEADER: {
    code: 'PERMISSION_NOT_LEADER',
    title: 'Permissão Negada: Perfil Insuficiente',
    message: 'Apenas usuários com perfil "Líder", "Diretor" ou "Admin" podem criar projetos.\n\n' +
             '✗ Seu perfil atual não possui essa permissão.\n' +
             '✓ Necessário: role === "Líder" OU isDirector === true OU isAdmin === true',
    action: 'Solicite ao administrador do sistema para alterar seu perfil.'
  },
  
  PERMISSION_NOT_PROJECT_OWNER: {
    code: 'PERMISSION_NOT_PROJECT_OWNER',
    title: 'Permissão Negada: Não é o Líder do Projeto',
    message: 'Apenas o líder responsável pode editar ou excluir este projeto.\n\n' +
             '✗ Você está tentando modificar um projeto que não é seu.\n' +
             '✓ Necessário: project.leaderEmail === seu email',
    action: 'Entre em contato com o líder do projeto para solicitar alterações.'
  },
  
  PERMISSION_CANNOT_VIEW: {
    code: 'PERMISSION_CANNOT_VIEW',
    title: 'Acesso Negado: Sem Permissão de Visualização',
    message: 'Você não tem permissão para visualizar este projeto.\n\n' +
             '✗ Acesso bloqueado pelas Firestore Rules.\n' +
             '✓ Permitido apenas para:\n' +
             '  • Líder do projeto (project.leaderEmail === seu email)\n' +
             '  • Membros do projeto (seu email em project.memberEmails)\n' +
             '  • Diretores (isDirector === true)\n' +
             '  • Admins (isAdmin === true)',
    action: 'Solicite ao líder do projeto para adicioná-lo como membro.'
  },
  
  PERMISSION_CANNOT_ADD_INTERACTION: {
    code: 'PERMISSION_CANNOT_ADD_INTERACTION',
    title: 'Permissão Negada: Apenas Líder Registra Interações',
    message: 'Apenas o líder responsável pode registrar interações no projeto.\n\n' +
             '✗ Você não é o líder deste projeto.\n' +
             '✓ Necessário: project.leaderEmail === seu email',
    action: 'Apenas o líder do projeto pode fazer registros de interações.'
  },
  
  // ==========================================
  // ERROS DE VALIDAÇÃO
  // ==========================================
  VALIDATION_EMPTY_NAME: {
    code: 'VALIDATION_EMPTY_NAME',
    title: 'Erro de Validação: Nome Obrigatório',
    message: 'O nome do projeto é obrigatório e não pode estar vazio.\n\n' +
             '✗ Campo "Nome" está vazio.\n' +
             '✓ Necessário: nome com pelo menos 3 caracteres',
    action: 'Preencha o campo "Nome do Projeto" antes de continuar.'
  },
  
  VALIDATION_EMPTY_DESCRIPTION: {
    code: 'VALIDATION_EMPTY_DESCRIPTION',
    title: 'Erro de Validação: Descrição Obrigatória',
    message: 'A descrição do projeto é obrigatória.\n\n' +
             '✗ Campo "Descrição" está vazio.\n' +
             '✓ Necessário: descrição com pelo menos 10 caracteres',
    action: 'Forneça uma descrição detalhada sobre o objetivo do projeto.'
  },
  
  VALIDATION_NO_MEMBERS: {
    code: 'VALIDATION_NO_MEMBERS',
    title: 'Erro de Validação: Sem Membros Selecionados',
    message: 'O projeto precisa ter pelo menos um membro.\n\n' +
             '✗ Nenhum colaborador foi selecionado.\n' +
             '✓ Necessário: pelo menos 1 membro no array memberIds',
    action: 'Selecione pelo menos um colaborador que fará parte deste projeto.'
  },
  
  VALIDATION_MEMBER_NOT_FOUND: {
    code: 'VALIDATION_MEMBER_NOT_FOUND',
    title: 'Erro de Validação: Membro Não Encontrado',
    message: 'Um ou mais membros selecionados não foram encontrados na base de funcionários.\n\n' +
             '✗ Employee ID inválido ou funcionário foi removido.\n' +
             '✓ Necessário: todos os IDs em memberIds devem existir em /employees',
    action: 'Remova os membros inválidos e selecione apenas colaboradores ativos.'
  },
  
  VALIDATION_INTERACTION_EMPTY_NOTES: {
    code: 'VALIDATION_INTERACTION_EMPTY_NOTES',
    title: 'Erro de Validação: Anotações Vazias',
    message: 'As anotações da interação não podem estar vazias.\n\n' +
             '✗ Campo de notas está vazio.\n' +
             '✓ Necessário: notas com pelo menos 5 caracteres',
    action: 'Preencha o campo de anotações antes de salvar a interação.'
  },
  
  VALIDATION_INTERACTION_NO_MEMBER: {
    code: 'VALIDATION_INTERACTION_NO_MEMBER',
    title: 'Erro de Validação: Membro Não Selecionado',
    message: 'Para interações 1:1, você deve selecionar um membro específico do projeto.\n\n' +
             '✗ Interação tipo "1:1" sem membro definido.\n' +
             '✓ Necessário: selecionar um employeeId válido',
    action: 'Selecione o membro com quem a interação foi realizada.'
  },
  
  // ==========================================
  // ERROS DO FIRESTORE
  // ==========================================
  FIRESTORE_PERMISSION_DENIED: {
    code: 'FIRESTORE_PERMISSION_DENIED',
    title: 'Erro Firestore: Permissão Negada',
    message: 'As regras de segurança do Firestore bloquearam esta operação.\n\n' +
             '✗ Firestore Rules rejeitou a operação.\n' +
             '⚠ Possíveis causas:\n' +
             '  1. Você não é o líder do projeto\n' +
             '  2. Seu token de autenticação expirou\n' +
             '  3. As Firestore Rules não foram atualizadas corretamente\n' +
             '  4. Seu email não está em project.memberEmails ou project.leaderEmail',
    action: 'Tente fazer logout e login novamente. Se persistir, verifique as Firestore Rules.'
  },
  
  FIRESTORE_NOT_FOUND: {
    code: 'FIRESTORE_NOT_FOUND',
    title: 'Erro Firestore: Documento Não Encontrado',
    message: 'O projeto que você está tentando acessar não existe.\n\n' +
             '✗ Documento não encontrado em /projects/{projectId}\n' +
             '⚠ Possíveis causas:\n' +
             '  1. Projeto foi excluído\n' +
             '  2. ID do projeto está incorreto\n' +
             '  3. Projeto ainda não foi criado',
    action: 'Verifique o ID do projeto ou volte para a lista de projetos.'
  },
  
  FIRESTORE_SAVE_ERROR: {
    code: 'FIRESTORE_SAVE_ERROR',
    title: 'Erro Firestore: Falha ao Salvar',
    message: 'Não foi possível salvar as informações no banco de dados.\n\n' +
             '✗ Operação de escrita falhou.\n' +
             '⚠ Possíveis causas:\n' +
             '  1. Sem conexão com a internet\n' +
             '  2. Firestore offline ou indisponível\n' +
             '  3. Quota de operações excedida',
    action: 'Verifique sua conexão e tente novamente em alguns segundos.'
  },
  
  FIRESTORE_NETWORK_ERROR: {
    code: 'FIRESTORE_NETWORK_ERROR',
    title: 'Erro de Rede: Sem Conexão',
    message: 'Não foi possível conectar ao Firestore.\n\n' +
             '✗ Falha de rede detectada.\n' +
             '⚠ Verificar:\n' +
             '  1. Conexão com a internet\n' +
             '  2. Status do Firebase (https://status.firebase.google.com)\n' +
             '  3. Firewall ou VPN bloqueando acesso',
    action: 'Reconecte-se à internet e recarregue a página.'
  },
  
  // ==========================================
  // ERROS DE CARREGAMENTO
  // ==========================================
  LOADING_PROJECTS_ERROR: {
    code: 'LOADING_PROJECTS_ERROR',
    title: 'Erro ao Carregar: Lista de Projetos',
    message: 'Não foi possível carregar a lista de projetos.\n\n' +
             '✗ Falha na query da coleção /projects\n' +
             '⚠ Verificar:\n' +
             '  1. Conexão com Firestore\n' +
             '  2. Permissões de leitura nas Firestore Rules\n' +
             '  3. Token de autenticação válido',
    action: 'Verifique sua conexão e tente novamente. Se persistir, contate o administrador.'
  },
  
  LOADING_MEMBERS_ERROR: {
    code: 'LOADING_MEMBERS_ERROR',
    title: 'Erro ao Carregar: Lista de Colaboradores',
    message: 'Não foi possível carregar a lista de colaboradores disponíveis.\n\n' +
             '✗ Falha na query da coleção /employees\n' +
             '⚠ Verificar:\n' +
             '  1. Coleção /employees existe\n' +
             '  2. Permissões de leitura em /employees\n' +
             '  3. Estrutura de dados dos employees',
    action: 'Recarregue a página. Se o erro persistir, contate o administrador.'
  },
  
  LOADING_INTERACTIONS_ERROR: {
    code: 'LOADING_INTERACTIONS_ERROR',
    title: 'Erro ao Carregar: Histórico de Interações',
    message: 'Não foi possível carregar o histórico de interações do projeto.\n\n' +
             '✗ Falha na query de /projects/{projectId}/interactions\n' +
             '⚠ Verificar:\n' +
             '  1. Subcoleção interactions existe\n' +
             '  2. Permissões de leitura na subcoleção\n' +
             '  3. Project ID correto',
    action: 'Tente recarregar a página do projeto.'
  },
  
  // ==========================================
  // ERRO GENÉRICO
  // ==========================================
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    title: 'Erro Inesperado',
    message: 'Ocorreu um erro inesperado que não foi mapeado.\n\n' +
             '✗ Erro desconhecido.\n' +
             '⚠ Verifique o console do navegador para mais detalhes.',
    action: 'Copie o erro do console e entre em contato com o suporte técnico.'
  }
};

// Helper para mapear erros do Firestore com logging detalhado
export function mapFirestoreError(error: any, context?: string): typeof ProjectErrors[keyof typeof ProjectErrors] {
  const code = error?.code || '';
  const message = error?.message || '';
  const stack = error?.stack || '';
  
  // Log detalhado para debugging
  console.group(`🔴 [PROJECT ERROR] ${context || 'Erro no Sistema de Projetos'}`);
  console.error('Timestamp:', new Date().toISOString());
  console.error('Error Code:', code);
  console.error('Error Message:', message);
  console.error('Full Error Object:', error);
  console.error('Stack Trace:', stack);
  console.groupEnd();
  
  // Mapeamento específico de erros do Firestore
  if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
    console.warn('💡 DIAGNÓSTICO: Firestore Rules bloqueou a operação');
    console.warn('   Verificar:');
    console.warn('   - Usuário está autenticado?');
    console.warn('   - Email do usuário está em project.leaderEmail ou project.memberEmails?');
    console.warn('   - Firestore Rules foram atualizadas no console do Firebase?');
    return ProjectErrors.FIRESTORE_PERMISSION_DENIED;
  }
  
  if (code === 'not-found') {
    console.warn('💡 DIAGNÓSTICO: Documento não existe no Firestore');
    console.warn('   Verificar:');
    console.warn('   - ID do projeto está correto?');
    console.warn('   - Projeto foi excluído?');
    return ProjectErrors.FIRESTORE_NOT_FOUND;
  }
  
  if (code === 'unavailable' || message.includes('network') || message.includes('offline')) {
    console.warn('💡 DIAGNÓSTICO: Problema de conexão com Firestore');
    console.warn('   Verificar:');
    console.warn('   - Internet está conectada?');
    console.warn('   - Firebase está online? (https://status.firebase.google.com)');
    return ProjectErrors.FIRESTORE_NETWORK_ERROR;
  }
  
  if (code === 'failed-precondition' || code === 'aborted') {
    console.warn('💡 DIAGNÓSTICO: Operação falhou por pré-condição');
    console.warn('   Possível conflito de escrita ou estado inconsistente');
    return ProjectErrors.FIRESTORE_SAVE_ERROR;
  }
  
  // Erro não mapeado - log completo para investigação
  console.warn('⚠️ ERRO NÃO MAPEADO - Adicionar tratamento específico');
  console.warn('   Por favor, reporte este erro ao desenvolvedor');
  
  return ProjectErrors.UNKNOWN_ERROR;
}

// Helper para logar operações bem-sucedidas (para tracking)
export function logProjectSuccess(operation: string, data?: any) {
  console.group(`✅ [PROJECT SUCCESS] ${operation}`);
  console.log('Timestamp:', new Date().toISOString());
  if (data) {
    console.log('Data:', data);
  }
  console.groupEnd();
}

// Helper para logar validações
export function logValidationError(field: string, value: any, expected: string) {
  console.group(`⚠️ [VALIDATION ERROR] Campo: ${field}`);
  console.warn('Valor Recebido:', value);
  console.warn('Valor Esperado:', expected);
  console.groupEnd();
}

