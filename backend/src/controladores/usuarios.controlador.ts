import { BUCKETS_SUPABASE, TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";

export async function enviarAvatar(req: Request, res: Response) {
  const { fileBase64, fileName, fileType } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = obterClienteSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!fileBase64) {
      return res.status(400).json({ error: "Missing file data" });
    }

    const supabaseAdmin = obterClienteSupabase();

    // 1. Ensure 'avatars' bucket exists and is public
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBucket = buckets?.some((b: any) => b.name === BUCKETS_SUPABASE.AVATARES);
      if (!hasBucket) {
        await supabaseAdmin.storage.createBucket(BUCKETS_SUPABASE.AVATARES, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ["image/*"]
        });
      }
    } catch (bucketErr) {
      console.warn("Error checking/creating 'avatars' bucket:", bucketErr);
    }

    // 2. Decode the Base64 file string into a Buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // 3. Generate file path
    const fileExt = fileName ? fileName.split(".").pop() : "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    // 4. Upload using admin client to bypass any user RLS policies
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKETS_SUPABASE.AVATARES)
      .upload(filePath, buffer, {
        contentType: fileType || "image/jpeg",
        cacheControl: "3600",
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 5. Get the public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKETS_SUPABASE.AVATARES)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 6. Update profiles database table
    const { error: updateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({ success: true, publicUrl });
  } catch (err: any) {
    console.error("Error in avatar upload proxy:", err);
    return res.status(500).json({ error: err.message || "Internal upload error" });
  }
}