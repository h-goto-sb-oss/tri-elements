# ============================================================
# GitHub Pages への初回公開。一度だけ実行すれば OK。
#
#   1. GitHub へのログイン（ブラウザでコードを入力するだけ）
#   2. リポジトリ作成＋push
#   3. GitHub Pages を有効化（dist/ フォルダを配信）
#
#   使い方: このプロジェクトのフォルダで PowerShell を開いて
#     .\tools\publish_github.ps1
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$gh = "$HOME\tools\ghcli\bin\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }   # 通常インストール済みならそちらを使う

Write-Host "== 1. GitHubにログインします。表示されるコードをブラウザで入力してください ==" -ForegroundColor Cyan
& $gh auth login --hostname github.com --git-protocol https --web

Write-Host ""
Write-Host "== 2. リポジトリを作って push します ==" -ForegroundColor Cyan
& $gh repo create tri-elements --public --source=. --remote=origin --push

Write-Host ""
Write-Host "== 3. GitHub Pages を有効化します（main ブランチの /dist を配信） ==" -ForegroundColor Cyan
$owner = & $gh api user --jq .login
try {
  & $gh api -X POST "repos/$owner/tri-elements/pages" -f "source[branch]=main" -f "source[path]=/dist" | Out-Null
} catch {
  & $gh api -X PUT "repos/$owner/tri-elements/pages" -f "source[branch]=main" -f "source[path]=/dist" | Out-Null
}

Write-Host ""
Write-Host "公開URL: https://$owner.github.io/tri-elements/" -ForegroundColor Green
Write-Host "（反映まで1〜2分ほどかかります）"
