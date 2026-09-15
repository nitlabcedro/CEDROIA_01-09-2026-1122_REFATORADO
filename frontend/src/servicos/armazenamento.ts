/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { usuarioEhAdmin } from "@/utilitarios/permissoes";
import { supabase } from "./supabase";
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

const GLOBAL_RECORDS_CACHE_MS = 60000;
let globalRecordsCache: IARecord[] | null = null;
let globalRecordsCacheEm = 0;
let globalRecordsRequest: Promise<IARecord[]> | null = null;

const mapRegistrosIaRows = (data: any[]): IARecord[] => {
  if (!data || data.length === 0) return [];
  return data
    .filter((item) => item.id !== "METADATA-SECTORS")
    .map((item) => {
      let record: IARecord;
      if (item.data) {
        record = item.data as IARecord;
        record.id = item.id;
        record.unidadeSetor = item.unidade_setor || record.unidadeSetor || "";
        record.ownerId = item.owner_id || record.ownerId || "";
      } else {
        record = {
          id: item.id,
          unidadeSetor: item.unidade_setor || "",
          ownerId: item.owner_id || "",
          nomeFerramenta: item.nome_ferramenta || "",
        } as any as IARecord;
      }

      if (item.status) {
        record.statusAuditoria = item.status as StatusAuditoria;
      }
      if (item.status_uso) {
        record.statusUso = item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : (item.status_uso as StatusUso);
      }
      return record;
    });
};

/** Reutiliza registros já carregados pelo useAplicacao (ex.: Nova Solicitação). */
export const seedGlobalRecordsCache = (records: IARecord[]) => {
  globalRecordsCache = records;
  globalRecordsCacheEm = Date.now();
};

export const getGlobalRecords = async (): Promise<IARecord[]> => {
  if (globalRecordsRequest) return globalRecordsRequest;
  if (globalRecordsCache && Date.now() - globalRecordsCacheEm < GLOBAL_RECORDS_CACHE_MS) {
    return [...globalRecordsCache];
  }

  globalRecordsRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      const mapped = mapRegistrosIaRows(data || []);
      globalRecordsCache = mapped;
      globalRecordsCacheEm = Date.now();
      return [...mapped];
    } catch (error) {
      console.error("Erro ao buscar registros globais:", error);
      return globalRecordsCache ? [...globalRecordsCache] : [];
    } finally {
      globalRecordsRequest = null;
    }
  })();

  return globalRecordsRequest;
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

    let result = await query.order('id', { ascending: true });
    let data = result.data;
    let error = result.error;
    let status = result.status;

    if (error && (error.code === '42703' || error.message?.includes('owner_id') || status === 400 || error.code === 'PGRST100')) {
      console.warn('⚠️ Coluna owner_id não existe. Buscando todos os registros públicos e filtrando na memória...');
      const fallbackResult = await supabase
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select('*')
        .order('id', { ascending: true });
      data = fallbackResult.data;
      error = fallbackResult.error;
      status = fallbackResult.status;
    }

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

        if (item.status) {
          record.statusAuditoria = item.status as StatusAuditoria;
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
    if (userId && isValidUUID(userId)) {
      resolvedOwnerId = userId;
    } else {
      const candidateOwnerId = record.ownerId || (record as any).owner_id;
      if (candidateOwnerId && isValidUUID(candidateOwnerId)) {
        resolvedOwnerId = candidateOwnerId;
      }
    }

    if (resolvedOwnerId) {
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
              role: 'user',
              updated_at: new Date().toISOString()
            });
        }
      } catch (profileErr) {
        console.warn('Erro ao garantir existência do perfil para o owner:', profileErr);
      }
    }

    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId 
    };

    const payload: Record<string, unknown> = { 
      id: record.id, 
      data: recordWithStatus,
      updated_at: new Date().toISOString(),
      unidade_setor: record.unidadeSetor || '',
      responsavel_preenchimento: record.responsavelPreenchimento || '',
      nome_ferramenta: record.nomeFerramenta || '',
      status: record.statusAuditoria || finalStatus,
      status_uso: record.statusUso || 'Em avaliação',
      owner_id: resolvedOwnerId
    };

    const getMissingColumnName = (message: string): string | null => {
      let match = message.match(/column "([^"]+)" does not exist/i);
      if (match) return match[1];
      
      match = message.match(/column ([a-zA-Z0-9_-]+) does not exist/i);
      if (match) return match[1];

      match = message.match(/could not find the column ([a-zA-Z0-9_-]+)/i);
      if (match) return match[1];

      return null;
    };

    let currentPayload = { ...payload };
    let attempts = 0;
    const maxAttempts = 12;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const { error } = await supabase
          .from(TABELAS_SUPABASE.REGISTROS_IA)
          .upsert(currentPayload);
        
        if (!error) {
          console.log(`✅ Registro ${record.id} salvo com sucesso no Supabase na tentativa ${attempts}!`);
          lastError = null;
          break;
        }
        
        lastError = error;
        const errMsg = error.message || '';
        const errCode = error.code || '';
        
        const isMissingColumn = errCode === '42703' || 
                               errCode === 'PGRST204' || 
                               errMsg.toLowerCase().includes('column') || 
                               errMsg.toLowerCase().includes('does not exist');
        
        if (isMissingColumn) {
          const missingCol = getMissingColumnName(errMsg);
          if (missingCol && missingCol in currentPayload) {
            console.warn(`⚠️ Coluna [${missingCol}] inexistente no banco. Removendo do payload...`);
            delete currentPayload[missingCol];
            continue;
          } else {
            const fallbackRemovals = ['owner_id', 'status_uso', 'status', 'unidade_setor', 'responsavel_preenchimento', 'nome_ferramenta', 'updated_at'];
            let removedSomething = false;
            for (const col of fallbackRemovals) {
              if (col in currentPayload) {
                console.warn(`⚠️ Erro de coluna não identificada. Removendo fallback [${col}]...`);
                delete currentPayload[col];
                removedSomething = true;
                break;
              }
            }
            if (removedSomething) {
              continue;
            }
          }
        }
        
        if (errMsg.toLowerCase().includes('violates foreign key constraint') && errMsg.toLowerCase().includes('owner_id')) {
          console.warn('⚠️ Violação de chave estrangeira em owner_id. Removendo owner_id...');
          delete currentPayload['owner_id'];
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
    if (userId && isValidUUID(userId)) {
      resolvedOwnerId = userId;
    } else {
      const candidateOwnerId = record.ownerId || (record as any).owner_id;
      if (candidateOwnerId && isValidUUID(candidateOwnerId)) {
        resolvedOwnerId = candidateOwnerId;
      }
    }

    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId
    };
    
    if (index === -1) records.push(recordWithStatus);
    else records[index] = recordWithStatus;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Local sync failed:', e);
  }
};

export const saveRecordsToSupabase = async (records: IARecord[], userId?: string, isAdmin?: boolean) => {
  console.log(`Syncing ${records.length} records to Supabase...`);
  for (const record of records) {
    await addRecord(record, userId, isAdmin);
  }
};

export const updateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin);
};

export const addOrUpdateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin);
};

export const deleteRecord = async (id: string) => {
  try {
    console.log(`🗑️ Iniciando exclusão em cascata do registro ${id} no Supabase...`);
    
    const { data: workflows, error: wfErr } = await supabase
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select('id')
      .eq('ia_record_id', id);

    if (wfErr) {
      console.warn("Aviso ao buscar workflows associados para exclusão:", wfErr);
    }

    if (workflows && workflows.length > 0) {
      const workflowIds = workflows.map(w => w.id);
      
      const { error: stepsErr } = await supabase
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .delete()
        .in('workflow_id', workflowIds);
      
      if (stepsErr) {
        console.error("Erro ao realizar exclusão das etapas de aprovação:", stepsErr);
      }

      const { error: wfDelErr } = await supabase
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .delete()
        .in('id', workflowIds);

      if (wfDelErr) {
        console.error("Erro ao realizar exclusão dos fluxos de aprovação:", wfDelErr);
      }
    }

    const { error } = await supabase
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    console.log(`✅ Registro ${id} e todas as suas dependências foram removidos com sucesso!`);
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    throw error;
  }

  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const records = JSON.parse(localData);
      const filtered = records.filter((r: any) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Error updating localStorage:', e);
  }
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

export const generateId = (records: IARecord[]): string => {
  if (records.length === 0) return "IA-CEDRO-0001";
  
  const ids = records.map(r => {
    const match = r.id.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  });
  
  const maxId = Math.max(...ids);
  return `IA-CEDRO-${(maxId + 1).toString().padStart(4, "0")}`;
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
const SECTORS_METADATA_ID = "METADATA-SECTORS";
const SECTORS_CACHE_MS = 300000;

export interface SectorMetadataDetail {
  description?: string;
  responsible?: string;
  status?: "Ativo" | "Inativo";
  cargos?: string[];
}

type SectorDetailsMap = Record<string, SectorMetadataDetail>;

let sectorsCache: string[] | null = null;
let sectorsCacheEm = 0;
let sectorsRequest: Promise<string[]> | null = null;

const readLocalSectors = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SECTORS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
};

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
    try {
      const { data, error } = await supabase
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("data")
        .eq("id", SECTORS_METADATA_ID)
        .maybeSingle();

      const metadata = data?.data as { sectors?: unknown; details?: unknown } | undefined;
      if (!error && Array.isArray(metadata?.sectors) && metadata.sectors.length > 0) {
        const sectors = metadata.sectors.filter((item): item is string => typeof item === "string");
        localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
        if (metadata.details && typeof metadata.details === "object" && !Array.isArray(metadata.details)) {
          localStorage.setItem(SECTOR_DETAILS_STORAGE_KEY, JSON.stringify(metadata.details));
        }
        sectorsCache = sectors;
        sectorsCacheEm = Date.now();
        return [...sectors];
      }
    } catch {
      // O fallback abaixo mantém a tela funcional quando o backend está indisponível.
    }

    const localSectors = readLocalSectors();
    sectorsCache = localSectors?.length ? localSectors : [...DEFAULT_SECTORS];
    sectorsCacheEm = Date.now();
    return [...sectorsCache];
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
    const payload = {
      id: SECTORS_METADATA_ID,
      unidade_setor: "METADATA",
      nome_ferramenta: "Configuração de Setores",
      responsavel_preenchimento: "ADMIN",
      data_registro: new Date().toISOString().split('T')[0],
      utiliza_ia: "Não",
      status_uso: "Em uso",
      data: {
        sectors,
        details: sectorDetails
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .upsert(payload);

    if (error) {
      console.error("Erro ao salvar config de setores no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro crítico ao salvar setores:", err);
    return false;
  }
};
