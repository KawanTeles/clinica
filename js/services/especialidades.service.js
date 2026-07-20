import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class EspecialidadesService {
  /**
   * Busca as configurações de especialidade da clínica
   */
  static async listEspecialidades() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('especialidades')
      .select('*')
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('nome', { ascending: true });
      
    if (error) throw error;
    return data;
  }

  /**
   * Resolução hierárquica do valor da consulta (Profissional > Especialidade)
   */
  static async resolvePricingFallback(profissionalId, especialidadeId) {
    // 1. Tentar pegar o valor sobrescrito no profissional
    const { data: relData, error: relError } = await supabase
      .from('profissional_especialidade')
      .select('valor_vista, valor_cartao')
      .eq('profissional_id', profissionalId)
      .eq('especialidade_id', especialidadeId)
      .single();

    if (relError && relError.code !== 'PGRST116') throw relError; // IGNORA erro de nulo

    // 2. Tentar pegar o valor base da especialidade
    const { data: espData, error: espError } = await supabase
      .from('especialidades')
      .select('valor_vista, valor_cartao')
      .eq('id', especialidadeId)
      .single();
      
    if (espError) throw espError;

    const finalValorVista = (relData && relData.valor_vista !== null) ? relData.valor_vista : espData.valor_vista;
    const finalValorCartao = (relData && relData.valor_cartao !== null) ? relData.valor_cartao : espData.valor_cartao;

    if (finalValorVista === null && finalValorCartao === null) {
      throw new Error("A configuração financeira está incompleta para esta especialidade. Defina um valor base ou um valor específico para o profissional.");
    }

    return { 
      valor_vista: finalValorVista, 
      valor_cartao: finalValorCartao 
    };
  }

  /**
   * Inativa a especialidade sem quebrar históricos (Soft Delete)
   */
  static async softDeleteEspecialidade(id) {
    // Antes de excluir, o banco deve impedir se houver consultas agendadas ativas (a nível de app ou trigger)
    const { data, error } = await supabase
      .from('especialidades')
      .update({ deleted_at: new Date().toISOString(), status: 'Inativa' })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    
    await UserService.logAudit('ESPECIALIDADE_DESATIVADA', id, { acao: 'Soft Delete' });
    return data;
  }
}
