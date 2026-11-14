# BrowserStack 자격 증명을 **이 창에서만** 받아 실기기 검수를 한 번 돌린다.
#
# 왜 이 방식인가
#   값이 채팅·명령 기록·파일·환경변수(영구)에 남지 않는다. 이 PowerShell 프로세스 안에서만 살고
#   스크립트가 끝나면 사라진다. Access Key 는 가려서 입력한다.
#
# 쓰는 법 (노트북 터미널에서)
#   powershell -ExecutionPolicy Bypass -File scripts\bs-run.ps1 -Mode --upload
#   powershell -ExecutionPolicy Bypass -File scripts\bs-run.ps1 -Mode --r25 -AppId bs://... -OutDir verification\round25
param(
  [string]$Mode = 'r26',
  [string]$AppId = '',
  [string]$OutDir = '',
  [string]$ApkPath = '',
  [string]$Runs = '',
  # BrowserStack 은 deviceName 이 없으면 세션을 열지 않는다. 이제까지 검수한 기기를 기본값으로 둔다.
  [string]$Device = 'Samsung Galaxy S23',
  [string]$OsVersion = '13.0'
)

$ErrorActionPreference = 'Stop'
$Mode = '--' + $Mode.TrimStart('-')
if ($Mode -notin @('--r28','--r28b','--r27','--r27rel','--r27color','--r26','--r25','--upload','--smoke','--full','--plan','--dry')) { throw '지원하지 않는 검수 모드' }
# 검수 모드는 늘 이번 APK 를 새로 올린다 — 예전 app_url 을 재사용하면 다른 APK 를 검수하게 된다.
if ($Mode -in @('--r26','--r27','--r27rel')) { $AppId = ''; Remove-Item Env:APP_ID -ErrorAction SilentlyContinue }
if ($Mode -eq '--r27' -and -not $env:BUDGET_MS) { $env:BUDGET_MS = '840000' }
$env:BS_ENV_ONLY = '1'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'BrowserStack 자격 증명 (이 창에서만 쓰입니다)'
$form.Size = New-Object System.Drawing.Size(460, 230)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true

$labelUser = New-Object System.Windows.Forms.Label
$labelUser.Text = 'Username'
$labelUser.Location = New-Object System.Drawing.Point(20, 20)
$labelUser.Size = New-Object System.Drawing.Size(400, 20)

$boxUser = New-Object System.Windows.Forms.TextBox
$boxUser.Location = New-Object System.Drawing.Point(20, 42)
$boxUser.Size = New-Object System.Drawing.Size(400, 24)
$boxUser.UseSystemPasswordChar = $true

$labelKey = New-Object System.Windows.Forms.Label
$labelKey.Text = 'Access Key (입력이 가려집니다)'
$labelKey.Location = New-Object System.Drawing.Point(20, 78)
$labelKey.Size = New-Object System.Drawing.Size(400, 20)

$boxKey = New-Object System.Windows.Forms.TextBox
$boxKey.Location = New-Object System.Drawing.Point(20, 100)
$boxKey.Size = New-Object System.Drawing.Size(400, 24)
$boxKey.UseSystemPasswordChar = $true

$ok = New-Object System.Windows.Forms.Button
$ok.Text = '검수 시작'
$ok.Location = New-Object System.Drawing.Point(240, 140)
$ok.Size = New-Object System.Drawing.Size(88, 30)
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK

$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = '취소'
$cancel.Location = New-Object System.Drawing.Point(334, 140)
$cancel.Size = New-Object System.Drawing.Size(86, 30)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

$form.Controls.AddRange(@($labelUser, $boxUser, $labelKey, $boxKey, $ok, $cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$form.Add_Shown({ $form.Activate(); Write-Output 'CREDENTIAL_FORM_SHOWN' })

$result = $form.ShowDialog()
if ($result -ne [System.Windows.Forms.DialogResult]::OK) { '취소했습니다. 아무것도 실행하지 않았습니다.'; exit 1 }

$user = $boxUser.Text.Trim()
$key = $boxKey.Text.Trim()
$form.Dispose()
if (-not $user -or -not $key) { '둘 다 입력해야 합니다. 실행하지 않았습니다.'; exit 1 }

$env:BROWSERSTACK_USERNAME = $user
$env:BROWSERSTACK_ACCESS_KEY = $key
if ($AppId) { $env:APP_ID = $AppId }
if ($OutDir) { $env:OUT_DIR = $OutDir }
if ($ApkPath) { $env:APK_PATH = $ApkPath }
$env:DEVICE = $Device
$env:OS_VERSION = $OsVersion

try {
  Set-Location $PSScriptRoot\..
  # webdriverio 는 이 저장소 밖에 둔다. 프로젝트에 넣으면 SOURCE_ID 가 바뀌어 '검수한 그 소스'라는
  # 근거가 흐려진다. 그래서 바깥 설치를 NODE_PATH 로만 빌려 쓴다.
  $tools = 'C:\bs-tools\node_modules\webdriverio'
  if (Test-Path $tools) { $env:WDIO_PATH = $tools } else { "경고: $tools 가 없습니다. C:\bs-tools 에서 npm install webdriverio@9 를 먼저 하세요." }
  # 검수 모드인데 올린 APK 주소가 없으면 먼저 올린다. 창을 두 번 띄우지 않기 위해서다.
  # -Runs 'r27|apk경로|출력폴더;r27rel|apk경로|출력폴더' — 창 한 번으로 APK 여러 개를 차례로 검수한다.
  # 각 APK 는 따로 올리고 따로 폴더에 남긴다. APK 별 증거가 섞이지 않게 하기 위해서다.
  $jobs = @()
  if ($Runs) { foreach ($r in ($Runs -split ';')) { $p = $r -split '\|'; $jobs += ,@(('--' + $p[0].TrimStart('-')), $p[1], $p[2]) } }
  else { $jobs += ,@($Mode, $env:APK_PATH, $env:OUT_DIR) }
  $failed = @()
  foreach ($job in $jobs) {
    $Mode = $job[0]
    if ($job[1]) { $env:APK_PATH = $job[1] }
    if ($job[2]) { $env:OUT_DIR = $job[2] }
    if ($Runs) { $AppId = ''; Remove-Item Env:APP_ID -ErrorAction SilentlyContinue }
    if ($Mode -eq '--r27' -and -not $env:BUDGET_MS) { $env:BUDGET_MS = '840000' }
    "=== $Mode · $($env:APK_PATH) → $($env:OUT_DIR)"
    if (-not $AppId -and $Mode -ne '--upload' -and $Mode -ne '--plan' -and $Mode -ne '--dry') {
      '먼저 APK 를 올립니다…'
      $uploadOut = & node scripts/android-inspect.cjs --upload 2>&1
      if ($LASTEXITCODE -ne 0) { $uploadOut | ForEach-Object { $_ }; $failed += "$Mode 업로드"; continue }
      $uploadOut | ForEach-Object { $_ }
      $line = $uploadOut | Where-Object { $_ -match 'APP_ID=(bs://\S+)' } | Select-Object -First 1
      if (-not $line) { '업로드에서 app_url 을 받지 못했습니다.'; $failed += "$Mode app_url"; continue }
      $null = $line -match 'APP_ID=(bs://\S+)'
      $env:APP_ID = $Matches[1]
      "이번 검수에 쓸 APP_ID: $($env:APP_ID)"
    }
    & node scripts/android-inspect.cjs $Mode
    if ($LASTEXITCODE -ne 0) { $failed += "$Mode 실행" }
  }
  if ($failed.Count) { throw ('실기기 검수 실패: ' + ($failed -join ', ')) }
} finally {
  # 무슨 일이 있어도 이 프로세스에서 값을 지운다.
  Remove-Item Env:BROWSERSTACK_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:BROWSERSTACK_ACCESS_KEY -ErrorAction SilentlyContinue
  $user = $null; $key = $null
  [System.GC]::Collect()
}
