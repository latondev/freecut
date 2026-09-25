Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\PC\.gemini\antigravity-ide\brain\73f19556-e7d3-49f2-be54-415fe22fbb5e\.user_uploaded\media_1790321625887.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

$outDir = "d:\Other\github\freecut\public\assets\capcut-templates"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

function CropCard($name, $x, $y, $w, $h) {
    $rect = [System.Drawing.Rectangle]::new($x, $y, $w, $h)
    $bmp = $src.Clone($rect, $src.PixelFormat)
    $destPath = Join-Path $outDir "$name.png"
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $destPath ($w x $h)"
}

# Trending row
CropCard "trending-1-sunburst" 84 320 96 96
CropCard "trending-2-cassette" 186 320 96 96
CropCard "trending-3-perfecto" 288 320 96 96
CropCard "trending-4-hearts" 390 320 84 96

# B.Duck row
CropCard "duck-1-foodie" 84 476 96 96
CropCard "duck-2-findjoy" 186 476 96 96
CropCard "duck-3-slumber" 288 476 96 96
CropCard "duck-4-lookatme" 390 476 84 96

# Black Friday row
CropCard "sale-1-badge" 84 632 96 96
CropCard "sale-2-30off" 186 632 96 96
CropCard "sale-3-50off" 288 632 96 96
CropCard "sale-4-hotsale" 390 632 84 96

# Whimsical row
CropCard "whimsical-1-dance" 84 782 96 96
CropCard "whimsical-2-beauty" 186 782 96 96
CropCard "whimsical-3-july" 288 782 96 96
CropCard "whimsical-4-summer" 390 782 84 96

$src.Dispose()
Write-Output "Refined cropping complete!"
