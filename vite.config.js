// ビルドした日時をアプリに埋め込む。
// 「直したはずが直っていない」の切り分けに、設定画面でこれを見てもらう。
const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16);

export default {
  define: { __BUILD__: JSON.stringify(stamp) },
};
