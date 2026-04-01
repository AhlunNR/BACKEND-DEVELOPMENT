import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';

export const processRecurringTransactions = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: activeRt, error: fetchErr } = await supabaseAdmin
      .from('recurring_transactions')
      .select('*')
      .eq('status', 'active')
      .lte('next_date', today);

    if (fetchErr) throw fetchErr;
    if (!activeRt || activeRt.length === 0) return { processed: 0 };

    let processedCount = 0;
    for (const rt of activeRt) {
      const { error: insertErr } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: rt.user_id,
          profile_id: rt.profile_id,
          category_id: rt.category_id,
          type: rt.type,
          amount: rt.amount,
          description: rt.description,
          date: today,
          note: 'Auto-generated from recurring transaction'
        });

      if (!insertErr) {
        const nextDateObj = new Date(today);
        if (rt.frequency === 'daily') nextDateObj.setDate(nextDateObj.getDate() + 1);
        if (rt.frequency === 'weekly') nextDateObj.setDate(nextDateObj.getDate() + 7);
        if (rt.frequency === 'monthly') nextDateObj.setMonth(nextDateObj.getMonth() + 1);
        if (rt.frequency === 'yearly') nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);

        const newNextDate = nextDateObj.toISOString().split('T')[0];
        await supabaseAdmin
          .from('recurring_transactions')
          .update({ next_date: newNextDate })
          .eq('id', rt.id);

        processedCount++;
      }
    }
    console.log(`[cron] Recurring transactions processed: ${processedCount}`);
    return { processed: processedCount };
  } catch (error) {
    console.error('[cron] Error processing recurring transactions:', error.message);
  }
};

export function startRecurringCron() {
  cron.schedule('0 1 * * *', async () => {
    console.log(`[cron] Running recurring transactions job - ${new Date().toISOString()}`);
    await processRecurringTransactions();
  }, { timezone: 'UTC' });
  console.log('[cron] Recurring transactions job scheduled - 01:00 UTC');
}
