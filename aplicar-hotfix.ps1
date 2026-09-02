$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$tsx = Join-Path $root "frontend\src\paginas\relatorios\VisualizacaoRelatorio.tsx"
$css = Join-Path $root "frontend\src\estilos\paginas\relatorios.css"

if (!(Test-Path -LiteralPath $tsx)) {
    throw "Arquivo nao encontrado: $tsx. Execute este script na raiz do projeto Cedro IA."
}
if (!(Test-Path -LiteralPath $css)) {
    throw "Arquivo nao encontrado: $css. Execute este script na raiz do projeto Cedro IA."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $tsx -Destination "$tsx.bak-$stamp" -Force
Copy-Item -LiteralPath $css -Destination "$css.bak-$stamp" -Force

$utf8 = New-Object System.Text.UTF8Encoding($false)
$tsxText = [System.IO.File]::ReadAllText($tsx, [System.Text.Encoding]::UTF8)
$cssText = [System.IO.File]::ReadAllText($css, [System.Text.Encoding]::UTF8)

# Normalize line endings only while processing.
$tsxText = $tsxText.Replace("`r`n", "`n")
$cssText = $cssText.Replace("`r`n", "`n")

# Remove only Card 3 from the Summary tab.
# The search uses ASCII-only markers to avoid Windows PowerShell encoding issues.
$cardToken = "Card 3"
$tab2Token = "{/* TAB 2:"
$cardPos = $tsxText.IndexOf($cardToken)

if ($cardPos -lt 0) {
    Write-Host "Card 3 nao encontrado. Ele pode ja ter sido removido." -ForegroundColor Yellow
}
else {
    $lineStart = $tsxText.LastIndexOf("`n", $cardPos)
    if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart += 1 }

    $tab2Pos = $tsxText.IndexOf($tab2Token, $cardPos)
    if ($tab2Pos -lt 0) {
        throw "Nao foi possivel localizar o inicio da aba 2. Nenhuma alteracao foi salva."
    }

    $wrapperMarker = "`n            </div>`n`n          </div>"
    $wrapperPos = $tsxText.IndexOf($wrapperMarker, $cardPos)

    if (($wrapperPos -lt 0) -or ($wrapperPos -gt $tab2Pos)) {
        throw "Nao foi possivel localizar com seguranca o final do Card 3. Nenhuma alteracao foi salva."
    }

    $tsxText = $tsxText.Remove($lineStart, $wrapperPos - $lineStart)
    [System.IO.File]::WriteAllText($tsx, $tsxText, $utf8)
    Write-Host "Card Classificacao Inicial removido sem alterar a aba Relatorio/PDF." -ForegroundColor Green
}

# Adjust only the Summary grid class. Do not change unrelated 3-column grids.
$pattern = '(?ms)(\.relatorio__grupo-38\s*\{[^}]*?)grid-template-columns\s*:\s*repeat\(3\s*,\s*minmax\(0\s*,\s*1fr\)\)(\s*!important)?\s*;'
$replacement = '$1grid-template-columns: repeat(2, minmax(0, 1fr))$2;'
$updatedCss = [System.Text.RegularExpressions.Regex]::Replace($cssText, $pattern, $replacement)

if ($updatedCss -eq $cssText) {
    if ($cssText -match '(?ms)\.relatorio__grupo-38\s*\{[^}]*?grid-template-columns\s*:\s*repeat\(2') {
        Write-Host "Grade do Resumo ja esta em 2 colunas." -ForegroundColor Yellow
    }
    else {
        $safeOverride = @"

/* HOTFIX RESUMO: manter dois cards no desktop e um no mobile. */
.relatorio__grupo-38 {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

@media (max-width: 900px) {
  .relatorio__grupo-38 {
    grid-template-columns: 1fr !important;
  }
}
"@
        $updatedCss = $cssText + $safeOverride
        [System.IO.File]::WriteAllText($css, $updatedCss, $utf8)
        Write-Host "Override seguro de grade adicionado ao CSS." -ForegroundColor Green
    }
}
else {
    [System.IO.File]::WriteAllText($css, $updatedCss, $utf8)
    Write-Host "Grade do Resumo ajustada para 2 colunas." -ForegroundColor Green
}

Write-Host "Hotfix concluido." -ForegroundColor Cyan
Write-Host "Arquivos de PDF nao foram modificados." -ForegroundColor Cyan
Write-Host "Backups criados com sufixo .bak-$stamp" -ForegroundColor Cyan
