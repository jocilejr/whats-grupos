import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface BackupFile {
  version: number;
  created_at: string;
  user_email: string;
  data: {
    profiles: any[];
    api_configs: any[];
    campaigns: any[];
    scheduled_messages: any[];
    message_templates: any[];
    message_logs: any[];
  };
  media: Record<string, string>;
}

type ProgressCallback = (step: string, progress: number) => void;

// ─── EXPORT ───

function extractMediaPaths(records: any[]): string[] {
  const paths = new Set<string>();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const mediaPrefix = `${supabaseUrl}/storage/v1/object/public/media/`;

  function walk(obj: any) {
    if (!obj) return;
    if (typeof obj === "string" && obj.startsWith(mediaPrefix)) {
      paths.add(obj.replace(mediaPrefix, ""));
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (typeof obj === "object") {
      Object.values(obj).forEach(walk);
    }
  }

  records.forEach(walk);
  return Array.from(paths);
}

export async function exportBackup(onProgress?: ProgressCallback): Promise<BackupFile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  onProgress?.("Buscando perfil...", 5);
  const { data: profiles } = await supabase.from("profiles").select("*");

  onProgress?.("Buscando instâncias...", 15);
  const { data: api_configs } = await supabase.from("api_configs").select("*");

  onProgress?.("Buscando campanhas...", 25);
  const { data: campaigns } = await supabase.from("campaigns").select("*");

  onProgress?.("Buscando mensagens agendadas...", 35);
  const { data: scheduled_messages } = await supabase.from("scheduled_messages").select("*");

  onProgress?.("Buscando templates...", 45);
  const { data: message_templates } = await supabase.from("message_templates").select("*");

  onProgress?.("Buscando histórico...", 55);
  const { data: message_logs } = await supabase.from("message_logs").select("*");

  const allRecords = [
    ...(message_templates || []),
    ...(scheduled_messages || []),
    ...(message_logs || []),
  ];
  const mediaPaths = extractMediaPaths(allRecords);

  let media: Record<string, string> = {};
  if (mediaPaths.length > 0) {
    onProgress?.(`Baixando ${mediaPaths.length} arquivo(s) de mídia...`, 65);
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await supabase.functions.invoke("backup-export", {
      body: { media_paths: mediaPaths },
    });
    if (resp.data?.media) {
      media = resp.data.media;
    }
  }

  onProgress?.("Gerando arquivo de backup...", 90);

  const backup: BackupFile = {
    version: 1,
    created_at: new Date().toISOString(),
    user_email: user.email || "",
    data: {
      profiles: profiles || [],
      api_configs: api_configs || [],
      campaigns: campaigns || [],
      scheduled_messages: scheduled_messages || [],
      message_templates: message_templates || [],
      message_logs: message_logs || [],
    },
    media,
  };

  onProgress?.("Backup concluído!", 100);
  return backup;
}

export function downloadBackup(backup: BackupFile) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().split("T")[0];
  a.download = `backup-whatsgrupos-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── IMPORT ───

export function validateBackupFile(data: any): data is BackupFile {
  return (
    data &&
    data.version === 1 &&
    data.data &&
    Array.isArray(data.data.api_configs) &&
    Array.isArray(data.data.campaigns) &&
    Array.isArray(data.data.scheduled_messages) &&
    Array.isArray(data.data.message_templates) &&
    Array.isArray(data.data.message_logs) &&
    Array.isArray(data.data.profiles)
  );
}

async function uploadMedia(media: Record<string, string>, userId: string): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  for (const [originalPath, dataUrl] of Object.entries(media)) {
    try {
      const [header, base64] = dataUrl.split(",");
      const mimeMatch = header.match(/data:(.+);base64/);
      const mimeType = mimeMatch?.[1] || "application/octet-stream";

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });

      const newPath = `${userId}/${Date.now()}-${originalPath.split("/").pop()}`;
      const { error } = await supabase.storage.from("media").upload(newPath, blob, {
        contentType: mimeType,
        upsert: false,
      });

      if (!error) {
        const oldUrl = `${supabaseUrl}/storage/v1/object/public/media/${originalPath}`;
        const newUrl = `${supabaseUrl}/storage/v1/object/public/media/${newPath}`;
        urlMap.set(oldUrl, newUrl);
      }
    } catch {
      // Skip failed uploads
    }
  }

  return urlMap;
}

function replaceUrls(obj: any, urlMap: Map<string, string>): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    return urlMap.get(obj) || obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceUrls(item, urlMap));
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceUrls(value, urlMap);
    }
    return result;
  }
  return obj;
}

function stripMeta(record: any) {
  const { id, created_at, updated_at, user_id, ...rest } = record;
  return rest;
}

export async function importBackup(backup: BackupFile, onProgress?: ProgressCallback) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  // 1. Upload media
  let urlMap = new Map<string, string>();
  if (backup.media && Object.keys(backup.media).length > 0) {
    onProgress?.(`Enviando ${Object.keys(backup.media).length} arquivo(s) de mídia...`, 10);
    urlMap = await uploadMedia(backup.media, user.id);
  }

  // 2. api_configs
  onProgress?.("Restaurando instâncias...", 25);
  const configIdMap = new Map<string, string>();
  for (const config of backup.data.api_configs) {
    const clean = stripMeta(config);
    const { data, error } = await supabase
      .from("api_configs")
      .insert({ ...clean, user_id: user.id })
      .select("id")
      .single();
    if (data) configIdMap.set(config.id, data.id);
  }

  // 3. campaigns
  onProgress?.("Restaurando campanhas...", 40);
  const campaignIdMap = new Map<string, string>();
  for (const campaign of backup.data.campaigns) {
    const clean = stripMeta(campaign);
    delete clean.api_config_id;
    const newConfigId = configIdMap.get(campaign.api_config_id);
    if (!newConfigId) continue;
    const { data } = await supabase
      .from("campaigns")
      .insert({ ...clean, user_id: user.id, api_config_id: newConfigId })
      .select("id")
      .single();
    if (data) campaignIdMap.set(campaign.id, data.id);
  }

  // 4. scheduled_messages
  onProgress?.("Restaurando mensagens agendadas...", 55);
  for (const msg of backup.data.scheduled_messages) {
    const clean = stripMeta(msg);
    delete clean.api_config_id;
    delete clean.campaign_id;
    const newConfigId = configIdMap.get(msg.api_config_id);
    if (!newConfigId) continue;
    const newCampaignId = msg.campaign_id ? campaignIdMap.get(msg.campaign_id) : null;
    const content = replaceUrls(clean.content, urlMap);
    await supabase.from("scheduled_messages").insert({
      ...clean,
      content: content as Json,
      user_id: user.id,
      api_config_id: newConfigId,
      campaign_id: newCampaignId,
    });
  }

  // 5. message_templates
  onProgress?.("Restaurando templates...", 70);
  for (const tpl of backup.data.message_templates) {
    const clean = stripMeta(tpl);
    const content = replaceUrls(clean.content, urlMap);
    await supabase.from("message_templates").insert({
      ...clean,
      content: content as Json,
      user_id: user.id,
    });
  }

  // 6. message_logs
  onProgress?.("Restaurando histórico...", 85);
  for (const log of backup.data.message_logs) {
    const clean = stripMeta(log);
    delete clean.api_config_id;
    delete clean.scheduled_message_id;
    const newConfigId = configIdMap.get(log.api_config_id);
    if (!newConfigId) continue;
    const content = replaceUrls(clean.content, urlMap);
    await supabase.from("message_logs").insert({
      ...clean,
      content: content as Json,
      user_id: user.id,
      api_config_id: newConfigId,
      scheduled_message_id: null,
    });
  }

  // 7. profiles (update)
  onProgress?.("Restaurando perfil...", 95);
  if (backup.data.profiles.length > 0) {
    const profile = backup.data.profiles[0];
    await supabase
      .from("profiles")
      .update({ display_name: profile.display_name })
      .eq("user_id", user.id);
  }

  onProgress?.("Restauração concluída!", 100);
}
