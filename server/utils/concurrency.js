/**
 * 有限并发的 map：最多 limit 个任务同时执行，保持结果顺序与输入一致。
 * 用于对外部行情源/资讯源的批量抓取，避免一次性打满所有资产触发限流。
 */
export async function mapWithConcurrency(items, limit, fn) {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  const concurrency = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
  let next = 0;

  async function worker() {
    while (next < list.length) {
      const index = next++;
      results[index] = await fn(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export default mapWithConcurrency;
