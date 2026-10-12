# 개인정보처리방침 게시(운영자 실행). site/privacy/index.html 을 main 브랜치 privacy/index.html 로 올린다 → GitHub Pages 에 반영.
# 지금 작업 브랜치는 건드리지 않는다(임시 작업 폴더 사용).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$src = (Resolve-Path 'site/privacy/index.html').Path
$wt = Join-Path $env:TEMP ('emoti-pub-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
git fetch -q origin
git worktree add -q --detach $wt origin/main
try {
  Copy-Item $src (Join-Path $wt 'privacy/index.html') -Force
  git -C $wt add privacy/index.html
  git -C $wt commit -q -m "privacy: 2026-10-12 revision - login required (member ID only), artist name, PRO status, cloud backup, contest entries, Firebase (US) processor and overseas transfer, retention, web account deletion, under-14 guardian consent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git -C $wt push -q origin HEAD:main
  Write-Host '게시했어요. 1~2분 뒤 https://dbs7010-cmd.github.io/emoticon-studio/privacy/ 에 반영돼요.' -ForegroundColor Green
} finally {
  git worktree remove --force $wt
}
