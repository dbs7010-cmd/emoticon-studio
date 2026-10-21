# 카카오·네이버·구글 비밀값을 차례로 넣는다(운영자 PC 전용). 붙여넣기 없이: 비밀값을 '복사'한 뒤 이 창에서 Enter → 클립보드에서 읽는다.
# 건너뛰려면 's' 입력 후 Enter. 값은 화면·파일에 남기지 않는다(임시 파일 즉시 삭제).
Set-Location (Split-Path $PSScriptRoot -Parent)
$items = @(
  @{ Name = 'KAKAO_CLIENT_SECRET'; Label = '카카오 클라이언트 시크릿(카카오 로그인 코드)'; Min = 20; Max = 50 },
  @{ Name = 'NAVER_CLIENT_SECRET'; Label = '네이버 Client Secret'; Min = 6; Max = 20 },
  @{ Name = 'GOOGLE_CLIENT_SECRET'; Label = '구글 클라이언트 보안 비밀번호(GOCSPX-로 시작)'; Min = 20; Max = 60 }
)
foreach ($it in $items) {
  while ($true) {
    Write-Host ''
    Write-Host ('[' + $it.Label + ']') -ForegroundColor Yellow
    $a = Read-Host '이 값을 복사했으면 Enter (건너뛰기: s 입력 후 Enter)'
    if ($a -eq 's') { Write-Host '건너뛰었어요.'; break }
    $plain = (Get-Clipboard -Raw)
    if ($plain) { $plain = $plain.Trim() }
    if (-not $plain -or $plain.Length -lt $it.Min -or $plain.Length -gt $it.Max -or $plain -match '\s') {
      Write-Host ('클립보드에 맞는 값이 없어요(길이 ' + ($(if ($plain) { $plain.Length } else { 0 })) + '). 비밀값을 다시 복사하고 Enter 를 눌러 주세요.') -ForegroundColor Red
      continue
    }
    Write-Host ('받은 값: 앞 3글자 ' + $plain.Substring(0, 3) + '… · 길이 ' + $plain.Length)
    $f = Join-Path $env:TEMP ('s' + [guid]::NewGuid().ToString('N') + '.txt')
    try { [IO.File]::WriteAllText($f, $plain); npx firebase functions:secrets:set $it.Name --data-file $f --project emoti-18d80 --force }
    finally { Remove-Item $f -ErrorAction SilentlyContinue }
    Set-Clipboard -Value ' '
    break
  }
}
Write-Host ''
Write-Host '끝났어요. 채팅에 "다 했어"라고 알려 주세요.' -ForegroundColor Green
