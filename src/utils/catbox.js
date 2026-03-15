import FormData from 'form-data';
import axios from 'axios';

export const uploadToCatbox = async (buffer, originalName) => {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  
  form.append('fileToUpload', buffer, { filename: originalName || 'receipt.jpg' });

  try {
    const response = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    console.log(`[Catbox] Upload response status: ${response.status}`);

    const url = response.data;
    if (typeof url !== 'string' || !url.startsWith('https://')) {
       throw new Error(`Catbox returned invalid URL: ${url}`);
    }
    return url.trim();
  } catch (error) {
    console.error('Error uploading to Catbox:', error);
    throw error;
  }
};
