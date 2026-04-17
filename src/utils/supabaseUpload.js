const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const uploadImage = async (file, folder) => {
  const filePath = `${folder}/${Date.now()}-${file.originalname}`;

  const { error } = await supabase.storage
    .from("Temple")
    .upload(filePath, file.buffer, {
      contentType: file.mimetype
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("Temple")
    .getPublicUrl(filePath);

  return data.publicUrl;
};

module.exports = uploadImage;
