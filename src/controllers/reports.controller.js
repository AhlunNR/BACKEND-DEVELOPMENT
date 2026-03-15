import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../config/supabase.js';

function getDateRange(q) {
  const now   = new Date();
  const start = q.start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end   = q.end_date   || new Date().toISOString().split('T')[0];
  return { start, end };
}

function buildTotals(rows) {
  return rows.reduce(
    (acc, r) => {
      const amt = Number(r.amount);
      if (r.type === 'income')  acc.total_income  += amt;
      if (r.type === 'expense') acc.total_expense += amt;
      return acc;
    },
    { total_income: 0, total_expense: 0 }
  );
}

export const getReport = async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const { type, category_id } = req.query;

    let q = supabaseAdmin
      .from('transactions')
      .select('*, categories(name, icon)')
      .eq('user_id', req.user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (type && ['income', 'expense'].includes(type)) q = q.eq('type', type);
    if (category_id) q = q.eq('category_id', category_id);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map(({ categories: cat, ...t }) => ({
      ...t,
      category_name: cat?.name ?? null,
      category_icon: cat?.icon ?? null,
    }));

    const totals = buildTotals(rows);
    return res.json({
      data: rows,
      summary: {
        period: { start, end },
        total_income:  totals.total_income,
        total_expense: totals.total_expense,
        profit_loss:   totals.total_income - totals.total_expense,
        count:         rows.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const exportCSV = async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const { type, category_id, user_id } = req.query;

    let q = supabaseAdmin
      .from('transactions')
      .select('date, type, amount, description, note, categories(name)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (user_id)    q = q.eq('user_id', user_id);
    if (type && ['income', 'expense'].includes(type)) q = q.eq('type', type);
    if (category_id) q = q.eq('category_id', category_id);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    const header = 'Tanggal,Tipe,Kategori,Jumlah,Deskripsi,Catatan\n';
    const body = rows
      .map((r) =>
        [
          r.date,
          r.type,
          r.categories?.name || '',
          r.amount,
          `"${(r.description || '').replace(/"/g, '""')}"`,
          `"${(r.note        || '').replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');

    const filename = `kasflow_report_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + header + body);
  } catch (err) {
    next(err);
  }
};

export const exportPDF = async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req.query);
    const { type, category_id, user_id, full_name: qName, email: qEmail } = req.query;

    let q = supabaseAdmin
      .from('transactions')
      .select('date, type, amount, description, categories(name)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (user_id)    q = q.eq('user_id', user_id);
    if (type && ['income', 'expense'].includes(type)) q = q.eq('type', type);
    if (category_id) q = q.eq('category_id', category_id);

    const { data: txData, error: txErr } = await q;
    if (txErr) throw txErr;

    const txRows     = (txData || []).map(({ categories: cat, ...t }) => ({ ...t, category: cat?.name ?? null }));
    const totals     = buildTotals(txRows);
    const profitLoss = totals.total_income - totals.total_expense;
    let userName  = qName  || null;
    let userEmail = qEmail || null;

    if ((!userName || !userEmail) && user_id) {
      const { data: dbUser } = await supabaseAdmin
        .from('users').select('full_name, email').eq('id', user_id).maybeSingle();
      if (dbUser) {
        userName  = userName  || dbUser.full_name;
        userEmail = userEmail || dbUser.email;
      }
      if (!userName || !userEmail) {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (authData?.user) {
          userName  = userName  || authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || null;
          userEmail = userEmail || authData.user.email || null;
        }
      }
    }
    const user = { full_name: userName, email: userEmail };

    const formatRp   = (n) => `Rp ${Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0 })}`;
    const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    const doc      = new PDFDocument({ margin: 40, size: 'A4' });
    const filename = `kasflow_report_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor('#6366f1').text('KasFlow', { align: 'center' })
       .fontSize(12).fillColor('#374151').text('Laporan Keuangan', { align: 'center' })
       .moveDown(0.3);

    doc.fontSize(10).fillColor('#6b7280')
       .text(`Nama: ${user.full_name || '-'}   |   Email: ${user.email || '-'}`, { align: 'center' })
       .text(`Periode: ${formatDate(start)} - ${formatDate(end)}`, { align: 'center' })
       .moveDown(1);

    const summaryY = doc.y;
    doc.rect(40, summaryY, 515, 70).fill('#f9fafb').stroke('#e5e7eb');
    doc.fillColor('#374151').fontSize(11);
    doc.text(`Total Pemasukan : ${formatRp(totals.total_income)}`,  55, summaryY + 12);
    doc.text(`Total Pengeluaran: ${formatRp(totals.total_expense)}`, 55, summaryY + 28);
    doc.fillColor(profitLoss >= 0 ? '#16a34a' : '#dc2626')
       .text(`Laba / Rugi     : ${formatRp(profitLoss)}`, 55, summaryY + 44);
    doc.moveDown(4.5);

    const colX = { date: 40, type: 120, category: 180, amount: 320, desc: 390 };
    const headerY = doc.y;
    doc.rect(40, headerY, 515, 18).fill('#6366f1');
    doc.fillColor('#ffffff').fontSize(9);
    doc.text('Tanggal',   colX.date,     headerY + 5, { width: 75 });
    doc.text('Tipe',      colX.type,     headerY + 5, { width: 55 });
    doc.text('Kategori',  colX.category, headerY + 5, { width: 135 });
    doc.text('Jumlah',    colX.amount,   headerY + 5, { width: 95 });
    doc.text('Deskripsi', colX.desc,     headerY + 5, { width: 170 });
    doc.moveDown(1.2);

    txRows.forEach((row, i) => {
      if (doc.y > 750) { doc.addPage(); doc.moveDown(1); }
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(40, rowY, 515, 16).fill('#f3f4f6');
      doc.fillColor(row.type === 'income' ? '#16a34a' : '#dc2626').fontSize(8);
      doc.text(formatDate(row.date),    colX.date,     rowY + 4, { width: 75 });
      doc.text(row.type === 'income' ? 'Pemasukan' : 'Pengeluaran', colX.type, rowY + 4, { width: 55 });
      doc.fillColor('#374151');
      doc.text(row.category || '-',    colX.category, rowY + 4, { width: 135 });
      doc.text(formatRp(row.amount),   colX.amount,   rowY + 4, { width: 95 });
      doc.text(row.description || '-', colX.desc,     rowY + 4, { width: 170 });
      doc.moveDown(1);
    });

    doc.moveDown(1).fontSize(8).fillColor('#9ca3af')
       .text(`Dicetak pada ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })} oleh KasFlow`, { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
};
