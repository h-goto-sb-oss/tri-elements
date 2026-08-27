# ============================================================
# GitHub Pages への公開。既に一度実行していれば再実行してもOK。
#
#   1. GitHub へのログイン（未ログインのときだけ、ブラウザでコードを入力）
#   2. リポジトリ作成＋push（既にあれば最新をpushするだけ）
#   3. dist/ の中身を gh-pages ブランチへ反映してGitHub Pagesを有効化
#
#   GitHub Pages の「ブランチから配信」は / か /docs しか選べないので、
#   master ブランチのファイル構成には手を加えず、gh-pages という
#   専用ブランチのルートに dist/ の中身だけを置いて配信する。
#
#   使い方: このプロジェクトのフォルダで PowerShell を開いて
#     .\tools\publish_github.ps1
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$gh = "$HOME\tools\ghcli\bin\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }   # 通常インストール済みならそちらを使う

Write-Host "== 1. GitHubへのログインを確認します ==" -ForegroundColor Cyan
& $gh auth status *>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "未ログインです。表示されるコードをブラウザで入力してください" -ForegroundColor Cyan
  & $gh auth login --hostname github.com --git-protocol https --web
} else {
  Write-Host "ログイン済みでした。そのまま進めます" -ForegroundColor DarkGray
}
$owner = & $gh api user --jq .login

Write-Host ""
Write-Host "== 2. リポジトリを作って push します ==" -ForegroundColor Cyan
& $gh repo view "$owner/tri-elements" *>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "リポジトリは既に有ります。最新の内容をpushします" -ForegroundColor DarkGray
  if (-not (git remote get-url origin 2>$null)) {
    git remote add origin "https://github.com/$owner/tri-elements.git"
  }
  git push -u origin HEAD
} else {
  & $gh repo create tri-elements --public --source=. --remote=origin --push
}

Write-Host ""
Write-Host "== 3. Pages用にビルドして gh-pages ブランチへ配信します ==" -ForegroundColor Cyan
# https://<ユーザー名>.github.io/tri-elements/ のようにサブパスで配信されるので、
# 素材のパスもそれに合わせて --base で焼き込む（通常の npm run build とは別出力）。
Remove-Item -Recurse -Force dist-pages -ErrorAction SilentlyContinue
npx vite build --base=/tri-elements/ --outDir dist-pages

# 現在のリポジトリを一切汚さないよう、専用の worktree（別フォルダ）で
# gh-pages ブランチを作り直して push する。
$worktree = Join-Path $env:TEMP "tri-elements-gh-pages"
Remove-Item -Recurse -Force $worktree -ErrorAction SilentlyContinue
git worktree remove gh-pages-deploy --force 2>$null | Out-Null
git branch -D gh-pages 2>$null | Out-Null
git worktree add --orphan -b gh-pages $worktree

Copy-Item dist-pages\* $worktree -Recurse -Force
New-Item -ItemType File -Path (Join-Path $worktree ".nojekyll") -Force | Out-Null

Push-Location $worktree
git add -A
git commit -q -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push -f origin gh-pages
Pop-Location
git worktree remove $worktree --force

Write-Host ""
Write-Host "== 4. GitHub Pages を有効化します ==" -ForegroundColor Cyan
try {
  & $gh api -X POST "repos/$owner/tri-elements/pages" -f "source[branch]=gh-pages" -f "source[path]=/" | Out-Null
} catch {
  & $gh api -X PUT "repos/$owner/tri-elements/pages" -f "source[branch]=gh-pages" -f "source[path]=/" | Out-Null
}

Write-Host ""
Write-Host "公開URL: https://$owner.github.io/tri-elements/" -ForegroundColor Green
Write-Host "（反映まで1〜2分ほどかかります。今後は素材やコードを変えたら、もう一度このスクリプトを実行してください）"
