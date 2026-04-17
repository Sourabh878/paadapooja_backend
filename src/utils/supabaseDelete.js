const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DeleteSupa = async (imageUrl) => {
  try {
    // 1. Identify the Bucket
    const bucketName = 'Temple'; 

    // 2. Extract the path starting from the folder name
    // If URL is: https://xyz.supabase.co/storage/v1/object/public/Temple/assets/image.jpg
    // splitPattern will be "/public/Temple/"
    const splitPattern = `/public/${bucketName}/`;
    const filePath = imageUrl.split(splitPattern)[1];

    if (!filePath) {
      console.error("Path extraction failed for URL:", imageUrl);
      return false;
    }

    // 
    
    // 3. Remove from Supabase Storage
    // filePath will be "assets/your-image-name.jpg"
    const { data, error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (storageError) {
      console.error("Supabase Storage Delete Error:", storageError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("DeleteSupa Exception:", err.message);
    return false;
  }
};

module.exports = DeleteSupa;