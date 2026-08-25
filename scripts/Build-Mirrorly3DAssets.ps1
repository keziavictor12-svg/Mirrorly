$ErrorActionPreference = "Stop"

$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceRoot = Join-Path $appRoot "assets-source\makehuman-cc0"
$outputRoot = Join-Path $appRoot "public\assets\models"

function Resize-Png {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][int]$MaximumSize
    )

    Add-Type -AssemblyName System.Drawing
    $sourceImage = [Drawing.Image]::FromFile($Source)
    try {
        $ratio = [Math]::Min(1.0, $MaximumSize / [double][Math]::Max($sourceImage.Width, $sourceImage.Height))
        $width = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $ratio))
        $height = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $ratio))
        $target = New-Object Drawing.Bitmap($width, $height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [Drawing.Graphics]::FromImage($target)
            try {
                $graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
            } finally {
                $graphics.Dispose()
            }
            $target.Save($Destination, [Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $target.Dispose()
        }
    } finally {
        $sourceImage.Dispose()
    }
}

function Convert-HairModel {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    & npx.cmd obj2gltf -i $SourcePath -o $DestinationPath --binary --doubleSidedMaterial --checkTransparency
    if ($LASTEXITCODE -ne 0) {
        throw "obj2gltf failed for $SourcePath"
    }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$bobRoot = Join-Path $sourceRoot "toigo_curled_under_bob"
Resize-Png -Source (Join-Path $bobRoot "GingerHair.png") -Destination (Join-Path $bobRoot "GingerHair-1536.png") -MaximumSize 1536
Resize-Png -Source (Join-Path $bobRoot "BakedHairNORMAL.png") -Destination (Join-Path $bobRoot "BakedHairNORMAL-1536.png") -MaximumSize 1536

Convert-HairModel -SourcePath (Join-Path $bobRoot "bob_curled_under.obj") -DestinationPath (Join-Path $outputRoot "bob-cc0.glb")
Convert-HairModel -SourcePath (Join-Path $sourceRoot "short01\short01.obj") -DestinationPath (Join-Path $outputRoot "short-cc0.glb")

Get-Item (Join-Path $outputRoot "bob-cc0.glb"), (Join-Path $outputRoot "short-cc0.glb") |
    Select-Object Name, Length
