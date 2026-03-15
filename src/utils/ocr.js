import Tesseract from 'tesseract.js';


export const extractReceiptData = async (buffer) => {
  console.log('[OCR] Memulai proses scanning gambar...');
  const { data: { text } } = await Tesseract.recognize(buffer, 'ind', {
    logger: m => console.log(`[OCR Progress] ${m.status}: ${Math.round(m.progress * 100)}%`)
  });
  console.log('[OCR] Scanning selesai. Mengekstrak data...');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let suggestedTotal = null;
  let suggestedDate = null;

  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if ((lower.includes('total') || lower.includes('jml') || lower.includes('bayar')) && !suggestedTotal) {
      const match = line.match(/[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?/);
      if (match) {
        const cleanNumber = match[0].replace(/[^\d]/g, '');
        if (cleanNumber.length > 3) suggestedTotal = Number(cleanNumber);
      }
    }

    if (!suggestedDate) {
      const dateMatch = line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/);
      if (dateMatch) {
         suggestedDate = dateMatch[0].replace(/\//g, '-');
      }
    }
  }

  return {
    rawText: text,
    suggestedTotal,
    suggestedDate
  };
};
