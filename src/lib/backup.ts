import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface BackupFile {
  version: number;
  created_at: string;
  user_email: string;
  source_url: string;
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

export interface BackupResult {
  mediaSuccess: number;
  mediaFailed: number;
  mediaTotal: number;
  failedFiles: string[];
}

type ProgressCallback = (step: string, progress: number) => void;

// ─── HELPERS ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chunkSize = 8192;
  const chunks: number[] = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    const slice = base64.substring(i, Math.min(i + chunkSize, base64.length));
    const decoded = atob(slice);
    for (let j = 0; j < decoded.length; j++) {
      chunks.push(decoded.charCodeAt(j));
    }
  }
  return new Uint8Array(chunks);
}

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

function replaceUrls(obj: any, urlMap: Map<string, string>, sourceUrl?: string, targetUrl?: string): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    let result = urlMap.get(obj) || obj;
    if (sourceUrl && targetUrl && sourceUrl !== targetUrl) {
      result = result.split(sourceUrl).join(targetUrl);
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceUrls(item, urlMap, sourceUrl, targetUrl));
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceUrls(value, urlMap, sourceUrl, targetUrl);
    }
    return result;
  }
  return obj;
}

function stripMeta(record: any) {
  const { id, created_at, updated_at, user_id, ...rest } = record;
  return rest;
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

async function checkScheduleDuplicate(
  client: any,
  userId: string,
  scheduleType: string,
  content: any,
  groupIds: string[],
): Promise<boolean> {
  const { data: candidates } = await client
    .from("scheduled_messages")
    .select("id, content, group_ids")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("schedule_type", scheduleType)
    .limit(100);

  if (!candidates?.length) return false;

  const runTime = content?.runTime;
  const weekDays = JSON.stringify((content?.weekDays || []).sort());
  const sortedGroups = JSON.stringify([...groupIds].sort());

  return candidates.some((c: any) => {
    const cContent = c.content as any;
    if (cContent?.runTime !== runTime) return false;
    if (JSON.stringify((cContent?.weekDays || []).sort()) !== weekDays) return false;
    const cGroups = JSON.stringify([...(c.group_ids || [])].sort());
    return cGroups === sortedGroups;
  });
}

// ─── EXPORT ───

export async function exportBackup(onProgress?: ProgressCallback): Promise<{ backup: BackupFile; result: BackupResult }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

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
  const message_logs: any[] = [];
  {
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from("message_logs")
        .select("*")
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      message_logs.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  const allRecords = [
    ...(message_templates || []),
    ...(scheduled_messages || []),
    ...(message_logs || []),
  ];
  const mediaPaths = extractMediaPaths(allRecords);

  let media: Record<string, string> = {};
  let mediaSuccess = 0;
  let mediaFailed = 0;
  const failedFiles: string[] = [];

  if (mediaPaths.length > 0) {
    for (let i = 0; i < mediaPaths.length; i++) {
      const fileName = getFileName(mediaPaths[i]);
      onProgress?.(`Baixando mídia ${i + 1}/${mediaPaths.length}: ${fileName}`, 65 + Math.round((i / mediaPaths.length) * 20));
      try {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${mediaPaths[i]}`;
        const resp = await fetch(publicUrl);
        if (!resp.ok) {
          mediaFailed++;
          failedFiles.push(fileName);
          console.warn(`[backup-export] Failed to download: ${fileName} (HTTP ${resp.status})`);
          continue;
        }
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        media[mediaPaths[i]] = `data:${blob.type};base64,${base64}`;
        mediaSuccess++;
      } catch (err) {
        mediaFailed++;
        failedFiles.push(fileName);
        console.error(`[backup-export] Error downloading ${fileName}:`, err);
      }
    }
  }

  onProgress?.("Gerando arquivo de backup...", 90);

  const backup: BackupFile = {
    version: 1,
    created_at: new Date().toISOString(),
    user_email: user.email || "",
    source_url: supabaseUrl,
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
  return {
    backup,
    result: {
      mediaSuccess,
      mediaFailed,
      mediaTotal: mediaPaths.length,
      failedFiles,
    },
  };
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

async function uploadMedia(
  media: Record<string, string>,
  userId: string,
  sourceUrl: string,
  onProgress?: ProgressCallback,
): Promise<{ urlMap: Map<string, string>; success: number; failed: number; failedFiles: string[] }> {
  const urlMap = new Map<string, string>();
  const targetUrl = import.meta.env.VITE_SUPABASE_URL;
  let success = 0;
  let failed = 0;
  const failedFiles: string[] = [];
  const entries = Object.entries(media);

  for (let i = 0; i < entries.length; i++) {
    const [originalPath, dataUrl] = entries[i];
    const fileName = getFileName(originalPath);
    onProgress?.(`Enviando mídia ${i + 1}/${entries.length}: ${fileName}`, 10 + Math.round((i / entries.length) * 15));

    try {
      const [header, base64] = dataUrl.split(",");
      const mimeMatch = header.match(/data:(.+);base64/);
      const mimeType = mimeMatch?.[1] || "application/octet-stream";

      // Chunked base64 decode
      const decoded = atob(base64);
      const bytes = new Uint8Array(decoded.length);
      const chunkSize = 8192;
      for (let offset = 0; offset < decoded.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, decoded.length);
        for (let j = offset; j < end; j++) {
          bytes[j] = decoded.charCodeAt(j);
        }
      }
      const blob = new Blob([bytes], { type: mimeType });

      const newPath = `${userId}/${Date.now()}-${fileName}`;
      const { error } = await supabase.storage.from("media").upload(newPath, blob, {
        contentType: mimeType,
        upsert: false,
      });

      if (!error) {
        // Use sourceUrl for old URL mapping (not targetUrl)
        const oldUrl = `${sourceUrl}/storage/v1/object/public/media/${originalPath}`;
        const newUrl = `${targetUrl}/storage/v1/object/public/media/${newPath}`;
        urlMap.set(oldUrl, newUrl);
        success++;
      } else {
        failed++;
        failedFiles.push(fileName);
        console.error(`[backup-import] Upload error for ${fileName}:`, error.message);
      }
    } catch (err) {
      failed++;
      failedFiles.push(fileName);
      console.error(`[backup-import] Error processing ${fileName}:`, err);
    }
  }

  return { urlMap, success, failed, failedFiles };
}

export async function importBackup(backup: BackupFile, onProgress?: ProgressCallback): Promise<BackupResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const targetUrl = import.meta.env.VITE_SUPABASE_URL;
  const sourceUrl = backup.source_url || "";

  // 1. Upload media
  let urlMap = new Map<string, string>();
  let mediaResult = { success: 0, failed: 0, failedFiles: [] as string[] };

  if (backup.media && Object.keys(backup.media).length > 0) {
    onProgress?.(`Enviando ${Object.keys(backup.media).length} arquivo(s) de mídia...`, 10);
    const result = await uploadMedia(backup.media, user.id, sourceUrl, onProgress);
    urlMap = result.urlMap;
    mediaResult = { success: result.success, failed: result.failed, failedFiles: result.failedFiles };
  }

  // 2. api_configs
  onProgress?.("Restaurando instâncias...", 30);
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
  onProgress?.("Restaurando campanhas...", 45);
  const campaignIdMap = new Map<string, string>();
  for (const campaign of backup.data.campaigns) {
    const clean = stripMeta(campaign);
    delete clean.api_config_id;
    const newConfigId = campaign.api_config_id ? configIdMap.get(campaign.api_config_id) : null;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ ...clean, user_id: user.id, api_config_id: newConfigId || null })
      .select("id")
      .single();
    if (error) {
      console.error("[backup-import] Failed to insert campaign:", campaign.name, error);
    }
    if (data) campaignIdMap.set(campaign.id, data.id);
  }

  // 4. scheduled_messages
  onProgress?.("Restaurando mensagens agendadas...", 55);
  for (const msg of backup.data.scheduled_messages) {
    const clean = stripMeta(msg);
    delete clean.api_config_id;
    delete clean.campaign_id;
    const newConfigId = msg.api_config_id ? configIdMap.get(msg.api_config_id) : null;
    const newCampaignId = msg.campaign_id ? campaignIdMap.get(msg.campaign_id) : null;
    const content = replaceUrls(clean.content, urlMap, sourceUrl, targetUrl);

    // Duplicate check: skip if an active scheduled_message already exists
    // with the same runTime, schedule_type, weekDays, and group_ids
    const msgContent = content as any;
    if (clean.is_active !== false && msgContent?.runTime && clean.schedule_type) {
      const { data: existing } = await supabase
        .from("scheduled_messages")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("schedule_type", clean.schedule_type)
        .limit(50);

      if (existing?.length) {
        // Check for content-level duplicates (same runTime + weekDays + groups)
        const isDuplicate = await checkScheduleDuplicate(
          supabase, user.id, clean.schedule_type, msgContent, clean.group_ids || msg.group_ids
        );
        if (isDuplicate) {
          console.warn(`[backup-import] Skipping duplicate scheduled_message: ${clean.schedule_type} at ${msgContent.runTime}`);
          continue;
        }
      }
    }

    await supabase.from("scheduled_messages").insert({
      ...clean,
      content: content as Json,
      user_id: user.id,
      api_config_id: newConfigId || null,
      campaign_id: newCampaignId || null,
    });
  }

  // 5. message_templates
  onProgress?.("Restaurando templates...", 70);
  for (const tpl of backup.data.message_templates) {
    const clean = stripMeta(tpl);
    const content = replaceUrls(clean.content, urlMap, sourceUrl, targetUrl);
    await supabase.from("message_templates").insert({
      ...clean,
      content: content as Json,
      user_id: user.id,
    });
  }

  // 6. message_logs (batch insert)
  onProgress?.("Restaurando histórico...", 85);
  const logRecords = backup.data.message_logs
    .map((log) => {
      const clean = stripMeta(log);
      delete clean.api_config_id;
      delete clean.scheduled_message_id;
      const newConfigId = log.api_config_id ? configIdMap.get(log.api_config_id) : null;
      const content = replaceUrls(clean.content, urlMap, sourceUrl, targetUrl);
      return {
        ...clean,
        content: content as Json,
        user_id: user.id,
        api_config_id: newConfigId || null,
        scheduled_message_id: null,
      };
    })
    .filter(Boolean);

  const BATCH_SIZE = 500;
  for (let i = 0; i < logRecords.length; i += BATCH_SIZE) {
    const batch = logRecords.slice(i, i + BATCH_SIZE);
    const pct = 85 + Math.round((i / logRecords.length) * 10);
    onProgress?.(`Restaurando histórico... (${i + batch.length}/${logRecords.length})`, pct);
    await supabase.from("message_logs").insert(batch as any[]);
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

  const totalMedia = backup.media ? Object.keys(backup.media).length : 0;
  return {
    mediaSuccess: mediaResult.success,
    mediaFailed: mediaResult.failed,
    mediaTotal: totalMedia,
    failedFiles: mediaResult.failedFiles,
  };
}
