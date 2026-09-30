import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const RESOURCE_TYPES = ["image", "video", "raw"];

export const uploadBuffer = (buffer: Buffer, folder = "attachments") =>
  new Promise<{ publicId: string; resourceType: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "auto", type: "authenticated" }, (error, result) => {
        if (error || !result) return reject(error || new Error("Upload failed"));
        resolve({ publicId: result.public_id, resourceType: result.resource_type });
      })
      .end(buffer);
  });

// storagePath format: "<resource_type>:<public_id>"
export const parseStoragePath = (storagePath: string) => {
  const i = storagePath.indexOf(":");
  const resourceType = i > 0 ? storagePath.slice(0, i) : "";
  if (!RESOURCE_TYPES.includes(resourceType)) return null; // legacy local path
  return { resourceType, publicId: storagePath.slice(i + 1) };
};

export const deleteStored = async (storagePath: string) => {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) return;
  await cloudinary.uploader.destroy(parsed.publicId, {
    resource_type: parsed.resourceType as any,
    type: "authenticated",
  });
};

export const signedUrlFor = (storagePath: string, opts: { download?: string } = {}) => {
  const parsed = parseStoragePath(storagePath);
  if (!parsed) throw new Error("Attachment is not available.");
  return cloudinary.url(parsed.publicId, {
    resource_type: parsed.resourceType as any,
    type: "authenticated",
    sign_url: true,
    secure: true,
    ...(opts.download ? { flags: "attachment" } : {}),
  });
};