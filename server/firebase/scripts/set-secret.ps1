# 서버 비밀값 넣기(운영자 PC 전용). 값은 화면·채팅·파일에 남기지 않는다(임시 파일은 바로 지움).
# 사용: .\scripts\set-secret.ps1 KAKAO_CLIENT_SECRET   (입력 칸이 나오면 비밀값을 붙여넣고 Enter)
param([Parameter(Mandatory = $true)][ValidateSet('KAKAO_CLIENT_SECRET', 'NAVER_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET')][string]$Name)
$expect = @{ KAKAO_CLIENT_SECRET = '32자 정도'; NAVER_CLIENT_SECRET = '10자 정도'; GOOGLE_CLIENT_SECRET = 'GOCSPX- 로 시작, 35자 정도' }[$Name]
$secure = Read-Host "$Name 붙여넣기(화면에 안 보여요, $expect)" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $plain) { Write-Host '비어 있어요. 다시 실행해 주세요.'; exit 1 }
Write-Host ("받은 값: 앞 3글자 '" + $plain.Substring(0, [Math]::Min(3, $plain.Length)) + "…' · 길이 " + $plain.Length)
$f = Join-Path $env:TEMP ('s' + [guid]::NewGuid().ToString('N') + '.txt')
try {
  [IO.File]::WriteAllText($f, $plain)
  npx firebase functions:secrets:set $Name --data-file $f --project emoti-18d80 --force
} finally { Remove-Item $f -ErrorAction SilentlyContinue }
