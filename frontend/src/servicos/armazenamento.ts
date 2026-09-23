/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { usuarioEhAdmin } from "@/utilitarios/permissoes";
import { supabase } from "./supabase";
import { obterColunaLegadaRemovivel } from "./compatibilidade-registros";
import {
  carregarSetoresGestaoDoSupabase,
  persistirSetoresGestaoNoSupabase,
  type MapaDetalhesSetor,
} from "./setores-gestao";
import {
  IARecord,
  StatusAuditoria,
  StatusUso,
  UserProfile
} from "@/tipos";

const STORAGE_KEY = CHAVES_ARMAZENAMENTO_LOCAL.INVENTARIO_LEGADO;

const PROFILES_CACHE_MS = 60000;
let profilesCache: UserProfile[] | null = null;
let profilesCacheEm = 0;
let profilesRequest: Promise<UserProfile[]> | null = null;

/** Reutiliza perfis já carregados pelo hook global (evita nova ida ao Supabase). */
export const seedProfilesCache = (profiles: UserProfile[]) => {
  profilesCache = profiles;
  profilesCacheEm = Date.now();
};

const patchProfilesCacheEntry = (profileId: string, updates: Partial<UserProfile>) => {
  if (!profilesCache) return;
  profilesCache = profilesCache.map((item) =>
    item.id === profileId ? { ...item, ...updates } : item,
  );
};

export const getProfiles = async (): Promise<UserProfile[]> => {
  if (profilesRequest) return profilesRequest;
  if (profilesCache && Date.now() - profilesCacheEm < PROFILES_CACHE_MS) {
    return [...profilesCache];
  }

  profilesRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from(TABELAS_SUPABASE.PERFIS)
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      profilesCache = data || [];
      profilesCacheEm = Date.now();
      return [...profilesCache];
    } catch (error) {
      console.error('Error fetching profiles:', error);
      return [];
    } finally {
      profilesRequest = null;
    }
  })();

  return profilesRequest;
};

export const getRecords = async (userId?: string, isAdmin?: boolean, userSector?: string, knownRole?: string): Promise<IARecord[]> => {
  let finalIsAdmin = isAdmin;
  try {
    try {
      localStorage.removeItem(STORAGE_KEY);
      const keysToRemove = ["records", "inventory", "ia_records", "workflows", "approvals"];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith("sb-") && keysToRemove.some(prefix => key.includes(prefix))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Erro ao limpar localStorage de fallbacks:", e);
    }

    if (userId && !finalIsAdmin && !knownRole && isValidUUID(userId)) {
      try {
        const { data: prof, error: profErr } = await supabase
          .from(TABELAS_SUPABASE.PERFIS)
          .select('role')
          .eq('id', userId)
          .single();
        if (!profErr && prof && usuarioEhAdmin(prof)) {
          console.log('👑 Role admin verificada diretamente no banco!');
          finalIsAdmin = true;
        }
      } catch (e) {
        console.warn('Erro ao checar admin no banco em getRecords:', e);
      }
    }

    console.log('🔍 Buscando registros no Supabase...', { userId, isAdmin: finalIsAdmin, userSector });

    let query = supabase
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select('*');

    if (!finalIsAdmin) {
      console.log('🛡️ Aplicando filtros de segurança para usuário comum (Setor OU Propriedade)');
      const sectors = (userSector || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
      
      if (sectors.length > 0) {
        const sectorConditions = sectors.map(s => `unidade_setor.ilike."${s}"`);
        if (userId) {
          sectorConditions.push(`owner_id.eq.${userId}`);
        }
        query = query.or(sectorConditions.join(','));
      } else if (userId) {
        query = query.eq('owner_id', userId);
      } else {
        query = query.eq('unidade_setor', '---SECTOR-BLANK-NO-ACCESS---');
      }
    }

    const { data, error, status } = await query.order('id', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar no Supabase:', error, 'Status:', status);
      throw error;
    }

    let resultRecords: IARecord[] = [];

    if (data && data.length > 0) {
      console.log(`✅ ${data.length} registros encontrados no Supabase.`);
      const filteredData = data.filter(item => item.id !== 'METADATA-SECTORS');
      resultRecords = filteredData.map(item => {
        let record: IARecord;
        
        if (item.data) {
          record = item.data as IARecord;
          record.id = item.id;
          record.unidadeSetor = item.unidade_setor || record.unidadeSetor || (record as any).unidade_setor || '';
          record.ownerId = item.owner_id || record.ownerId || (record as any).owner_id || '';
        } else {
          record = {
            id: item.id,
            unidadeSetor: item.unidade_setor || '',
            responsavelPreenchimento: item.responsavel_preenchimento || '',
            cargo: item.cargo || '',
            dataRegistro: item.data_registro || new Date().toISOString().split('T')[0],
            utilizaIA: item.utiliza_ia || 'Sim',
            nomeFerramenta: item.nome_ferramenta || 'IA sem nome',
            fornecedor: item.fornecedor || 'Desconhecido',
            statusUso: item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : ((item.status_uso as StatusUso) || StatusUso.EM_AVALIACAO),
            createdAt: item.created_at || new Date().toISOString(),
            updatedAt: item.updated_at || new Date().toISOString(),
            ownerId: item.owner_id || '',
            historico: []
          } as any as IARecord;
        }

        if (item.status_uso) {
          record.statusUso = item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : (item.status_uso as StatusUso);
        }

        if (!record.statusAuditoria) {
          record.statusAuditoria = StatusAuditoria.PENDENTE;
        }

        return record;
      });
    } else {
      console.log('ℹ️ Supabase retornou 0 registros.');
      resultRecords = [];
    }

    if (!finalIsAdmin) {
      const activeSectors = (userSector || '')
        .split(';')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      console.log(`🛡️ Filtrando registros para os setores do usuário: ${activeSectors.join(', ')} ou criados pelo próprio usuário`);
      resultRecords = resultRecords.filter(r => {
        const rSector = (r.unidadeSetor || (r as any).unidade_setor || '').trim().toLowerCase();
        const rOwner = r.ownerId || (r as any).owner_id || '';
        const isOwner = userId && String(rOwner) === String(userId);
        const matchesSector = activeSectors.includes(rSector);
        return matchesSector || isOwner;
      });
    }

    return resultRecords;
  } catch (error) {
    console.error('💥 Erro crítico no getRecords:', error);
    return [];
  }
};

const isValidUUID = (id: unknown): boolean => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export const addRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return persistirRegistroIa(record, userId, isAdmin, "criar");
};

async function persistirRegistroIa(
  record: IARecord,
  userId: string | undefined,
  isAdmin: boolean | undefined,
  modo: "criar" | "atualizar",
) {
  let finalIsAdmin = isAdmin;
  try {
    if (userId && !finalIsAdmin && isValidUUID(userId)) {
      try {
        const { data: prof } = await supabase
          .from(TABELAS_SUPABASE.PERFIS)
          .select('role')
          .eq('id', userId)
          .single();
        if (usuarioEhAdmin(prof)) {
          finalIsAdmin = true;
        }
      } catch (e) {}
    }

    console.log('☁️ Tentando salvar registro no Supabase com resiliência total:', record.id, { isAdmin: finalIsAdmin });
    
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    
    let resolvedOwnerId: string | null = null;
    if (modo === "criar") {
      if (!userId || !isValidUUID(userId)) {
        throw new Error("Não foi possível criar a solicitação: owner_id autenticado é obrigatório.");
      }
      resolvedOwnerId = userId;
    } else {
      const { data: registroExistente, error: erroRegistroExistente } = await supabase
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("owner_id")
        .eq("id", record.id)
        .single();

      if (erroRegistroExistente) throw erroRegistroExistente;
      if (registroExistente?.owner_id && isValidUUID(registroExistente.owner_id)) {
        resolvedOwnerId = registroExistente.owner_id;
      }
    }

    if (modo === "criar" && resolvedOwnerId) {
      try {
        const { data: profileCheck } = await supabase
          .from(TABELAS_SUPABASE.PERFIS)
          .select('id')
          .eq('id', resolvedOwnerId)
          .maybeSingle();

        if (!profileCheck) {
          console.log(`👤 Profile para o owner ${resolvedOwnerId} não existe. Criando perfil básico...`);
          await supabase
            .from(TABELAS_SUPABASE.PERFIS)
            .insert({
              id: resolvedOwnerId,
              full_name: record.responsavelPreenchimento || 'Membro Cedro',
              setor: record.unidadeSetor || '',
              cargo: record.cargo || '',
              updated_at: new Date().toISOString()
            });
        }
      } catch (profileErr) {
        console.warn('Erro ao garantir existência do perfil para o owner:', profileErr);
      }
    }

    const recordWithStatus: IARecord & { owner_id?: string } = {
      ...record, 
      statusAuditoria: finalStatus,
      ...(resolvedOwnerId ? { ownerId: resolvedOwnerId } : {}),
    };
    delete recordWithStatus.owner_id;
    if (!resolvedOwnerId) delete recordWithStatus.ownerId;

    const payload: Record<string, unknown> = { 
      id: record.id, 
      data: recordWithStatus,
      updated_at: new Date().toISOString(),
      unidade_setor: record.unidadeSetor || '',
      responsavel_preenchimento: record.responsavelPreenchimento || '',
      nome_ferramenta: record.nomeFerramenta || '',
      status_uso: record.statusUso || 'Em avaliação',
    };

    if (modo === "criar") payload.owner_id = resolvedOwnerId;

    let currentPayload = { ...payload };
    let attempts = 0;
    const maxAttempts = 12;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const tabela = supabase.from(TABELAS_SUPABASE.REGISTROS_IA);
        const { error } = modo === "criar"
          ? await tabela.insert(currentPayload)
          : await tabela.update(currentPayload).eq("id", record.id);
        
        if (!error) {
          console.log(`✅ Registro ${record.id} salvo com sucesso no Supabase na tentativa ${attempts}!`);
          lastError = null;
          break;
        }
        
        lastError = error;
        const colunaLegada = obterColunaLegadaRemovivel(error, currentPayload);
        if (colunaLegada) {
          console.warn(`⚠️ Coluna legada [${colunaLegada}] inexistente no banco. Removendo do payload...`);
          delete currentPayload[colunaLegada];
          continue;
        }

        break;
      } catch (e) {
        lastError = e;
        break;
      }
    }

    if (lastError) {
      console.error('❌ Erro definitivo ao salvar no Supabase:', lastError);
      throw lastError;
    }
  } catch (error) {
    console.error('Error adding to Supabase:', error);
    throw error; 
  }
  
  // Local fallback
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const records: IARecord[] = localData ? JSON.parse(localData) : [];
    const index = records.findIndex(r => r.id === record.id);
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    
    let resolvedOwnerId: string | null = null;
    if (modo === "criar") {
      if (userId && isValidUUID(userId)) {
        resolvedOwnerId = userId;
      }
    } else {
      const registroLocalExistente = index >= 0 ? records[index] : null;
      const ownerExistente = registroLocalExistente?.ownerId
        || (registroLocalExistente as (IARecord & { owner_id?: string }) | null)?.owner_id;
      if (ownerExistente && isValidUUID(ownerExistente)) {
        resolvedOwnerId = ownerExistente;
      }
    }

    const recordWithStatus: IARecord & { owner_id?: string } = {
      ...record, 
      statusAuditoria: finalStatus,
      ...(resolvedOwnerId ? { ownerId: resolvedOwnerId } : {}),
    };
    delete recordWithStatus.owner_id;
    if (!resolvedOwnerId) delete recordWithStatus.ownerId;
    
    if (index === -1) records.push(recordWithStatus);
    else records[index] = recordWithStatus;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Local sync failed:', e);
  }
};

export const updateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  if (!isAdmin) {
    throw new Error("Somente administradores podem editar cadastros.");
  }
  return persistirRegistroIa(record, userId, isAdmin, "atualizar");
};

export const checkSupabaseStatus = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from(TABELAS_SUPABASE.REGISTROS_IA).select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
};

export const updateUserProfile = async (profileId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    const allowedKeys = ['id', 'updated_at', 'full_name', 'avatar_url', 'cargo', 'setor', 'contato', 'role', 'last_seen', 'sector_locked'];
    const sanitizedUpdates: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (updates[key as keyof UserProfile] !== undefined) {
        sanitizedUpdates[key] = updates[key as keyof UserProfile];
      }
    }

    const isPresenceOnly = Object.keys(sanitizedUpdates).length === 1 && sanitizedUpdates.hasOwnProperty('last_seen');
    if (!isPresenceOnly) {
      console.log(`📡 Enviando atualização para perfil ${profileId}:`, updates);
    }

    const query = supabase
      .from(TABELAS_SUPABASE.PERFIS)
      .update(sanitizedUpdates)
      .eq('id', profileId);
    const { data, error } = isPresenceOnly ? await query : await query.select();

    if (error) {
      if (isPresenceOnly) {
        console.warn('⚠️ Falha silenciosa no heartbeat de presença:', error.message || error);
        return null;
      }

      const isLastSeenError = updates.hasOwnProperty('last_seen') && (
        error.code === 'PGRST204' || 
        error.code === '42703' || 
        (error.message && (
          error.message.includes('last_seen') || 
          error.message.includes('column') || 
          error.message.includes('does not exist')
        ))
      );

      if (isLastSeenError) {
        console.warn('⚠️ Coluna "last_seen" não encontrada no Supabase.');
        return null;
      }
      console.error('❌ Erro Supabase ao atualizar perfil:', error);
      throw error;
    }

    if (isPresenceOnly) return null;
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhuma linha foi atualizada.');
      return null;
    }

    const atualizado = data[0] as UserProfile;
    patchProfilesCacheEntry(profileId, atualizado);
    console.log('✅ Perfil atualizado com sucesso:', atualizado);
    return atualizado;
  } catch (error: any) {
    const isPresenceOnly = Object.keys(updates).length === 1 && updates.hasOwnProperty('last_seen');
    if (isPresenceOnly) {
      console.warn('⚠️ Falha ao atualizar presença do usuário:', error.message || error);
      return null;
    }
    console.error('Error updating user profile:', error);
    throw error;
  }
};

export const DEFAULT_SECTORS = [
  "NIT",
  "TI",
  "Marketing",
  "Administrativo",
  "Jurídico",
  "Direção Técnica",
  "Qualidade",
  "Atendimento / Recepção",
  "Laboratório de Patologia",
  "Laboratório Central"
];

const SECTORS_STORAGE_KEY = CHAVES_ARMAZENAMENTO_LOCAL.SETORES_LEGADO;

const SECTOR_DETAILS_STORAGE_KEY = CHAVES_ARMAZENAMENTO_LOCAL.DETALHES_SETORES;
const SECTORS_CACHE_MS = 300000;

export interface SectorMetadataDetail {
  description?: string;
  responsible?: string;
  status?: "Ativo" | "Inativo";
  cargos?: string[];
}

type SectorDetailsMap = MapaDetalhesSetor;

let sectorsCache: string[] | null = null;
let sectorsCacheEm = 0;
let sectorsRequest: Promise<string[]> | null = null;

export const getSectorDetails = (): SectorDetailsMap => {
  try {
    const raw = localStorage.getItem(SECTOR_DETAILS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SectorDetailsMap : {};
  } catch {
    return {};
  }
};

export const getSectors = async (): Promise<string[]> => {
  if (sectorsCache && Date.now() - sectorsCacheEm < SECTORS_CACHE_MS) return [...sectorsCache];
  if (sectorsRequest) return sectorsRequest;

  sectorsRequest = (async () => {
    const oficial = await carregarSetoresGestaoDoSupabase();
    if (!oficial || oficial.nomes.length === 0) {
      throw new Error("Não foi possível carregar os setores oficiais.");
    }

    try {
      localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(oficial.nomes));
      localStorage.setItem(SECTOR_DETAILS_STORAGE_KEY, JSON.stringify(oficial.detalhes));
    } catch (e) {
      console.warn("Não foi possível cachear setores oficiais no localStorage:", e);
    }

    sectorsCache = oficial.nomes;
    sectorsCacheEm = Date.now();
    return [...oficial.nomes];
  })().finally(() => {
    sectorsRequest = null;
  });

  return sectorsRequest;
};

export const saveSectors = async (sectors: string[], details?: SectorDetailsMap): Promise<boolean> => {
  const sectorDetails = details || getSectorDetails();
  try {
    localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
    localStorage.setItem(SECTOR_DETAILS_STORAGE_KEY, JSON.stringify(sectorDetails));
    sectorsCache = [...sectors];
    sectorsCacheEm = Date.now();
  } catch (e) {
    console.error(e);
  }

  try {
    const persistidoOficial = await persistirSetoresGestaoNoSupabase(sectors, sectorDetails);
    if (!persistidoOficial) {
      console.error("Erro ao salvar setores na tabela oficial do Supabase.");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro crítico ao salvar setores:", err);
    return false;
  }
};
