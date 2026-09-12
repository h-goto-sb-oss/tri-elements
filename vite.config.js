// ビルドした日時をアプリに埋め込む。
// 「直したはずが直っていない」の切り分けに、設定画面でこれを見てもらう。
const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16);

export default {
  define: { __BUILD__: JSON.stringify(stamp) },
  // 配布物・動画のコマなど、ゲームの外で大量に書き出す場所は dev サーバーに見張らせない。
  // 紹介動画の録画（数百枚のコマ）で見張りが詰まり、ページが開かなくなった（2026-09-12）
  server: { watch: { ignored: ['**/release/**', '**/dist-pages/**', '**/dist-itch/**', '**/dist/**'] } },
};
