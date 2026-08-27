#!/usr/bin/env bash
# ============================================================
# GitHub Pages への初回公開。一度だけ実行すれば OK。
#
#   1. GitHub へのログイン（ブラウザでコードを入力するだけ）
#   2. リポジトリ作成＋push
#   3. GitHub Pages を有効化（dist/ フォルダを配信）
#
#   使い方: このプロジェクトのフォルダで
#     bash tools/publish_github.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

GH="$HOME/tools/ghcli/bin/gh.exe"
if [ ! -x "$GH" ]; then GH=gh; fi   # 通常インストール済みならそちらを使う

echo "== 1. GitHubにログインします。表示されるコードをブラウザで入力してください =="
"$GH" auth login --hostname github.com --git-protocol https --web

echo
echo "== 2. リポジトリを作って push します =="
"$GH" repo create tri-elements --public --source=. --remote=origin --push

echo
echo "== 3. GitHub Pages を有効化します（main ブランチの /dist を配信） =="
OWNER=$("$GH" api user --jq .login)
"$GH" api -X POST "repos/$OWNER/tri-elements/pages" \
  -f "source[branch]=main" -f "source[path]=/dist" >/dev/null 2>&1 || \
"$GH" api -X PUT "repos/$OWNER/tri-elements/pages" \
  -f "source[branch]=main" -f "source[path]=/dist"

echo
echo "公開URL: https://$OWNER.github.io/tri-elements/"
echo "（反映まで1〜2分ほどかかります）"
