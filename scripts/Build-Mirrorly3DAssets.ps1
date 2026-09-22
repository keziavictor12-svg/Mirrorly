$ErrorActionPreference = "Stop"

$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceRoot = Join-Path $appRoot "assets-source\makehuman-cc0"
$ccBySourceRoot = Join-Path $appRoot "assets-source\makehuman-cc-by"
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

function New-HairVariant {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath,
        [Parameter(Mandatory = $true)]
        [ValidateSet("Copy", "Feather", "V", "U", "Buzz", "Curtain", "Fade")]
        [string]$Shape
    )

    $invariant = [Globalization.CultureInfo]::InvariantCulture
    $output = New-Object System.Collections.Generic.List[string]
    $output.Add("# Mirrorly browser-ready derivative; original source and license metadata remain in this folder.")
    $output.Add("# Rebuild with scripts/Build-Mirrorly3DAssets.ps1. Shape: $Shape")
    $output.Add("mtllib mirrorly.mtl")

    foreach ($line in [IO.File]::ReadLines($SourcePath)) {
        if ($line.StartsWith("mtllib ", [StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        if ($line.StartsWith("vn ")) {
            continue
        }
        if ($line.StartsWith("f ")) {
            $faceParts = $line.Split(" ", [StringSplitOptions]::RemoveEmptyEntries)
            $vertices = for ($index = 1; $index -lt $faceParts.Length; $index++) {
                $indices = $faceParts[$index].Split("/")
                if ($indices.Length -gt 1 -and $indices[1]) {
                    "$($indices[0])/$($indices[1])"
                } else {
                    $indices[0]
                }
            }
            $output.Add("f " + ($vertices -join " "))
            continue
        }
        if (-not $line.StartsWith("v ")) {
            $output.Add($line)
            continue
        }

        $parts = $line.Split(" ", [StringSplitOptions]::RemoveEmptyEntries)
        $x = [double]::Parse($parts[1], $invariant)
        $y = [double]::Parse($parts[2], $invariant)
        $z = [double]::Parse($parts[3], $invariant)

        switch ($Shape) {
            "Feather" {
                # Extend the clean bob topology to shoulder length and gently
                # flare the lower strands. The former high-poly Feather source
                # imported as a tangled mesh in DeepAR Studio.
                if ($y -lt 7.10) {
                    $lowerRatio = [Math]::Min(1.0, [Math]::Max(0, (7.10 - $y) / 1.57))
                    $y = 7.10 + ($y - 7.10) * 1.35
                    $x *= 1.0 + 0.20 * $lowerRatio
                    $z += 0.05 * $lowerRatio
                }
            }
            "V" {
                if ($y -lt 2.45) {
                    $xRatio = [Math]::Min(1.0, [Math]::Abs($x) / 1.2707)
                    $floor = 0.94 + 1.18 * $xRatio
                    if ($y -lt $floor) {
                        $y = $floor + [Math]::Max(0, $y - 0.8366) * 0.06
                    }
                }
            }
            "U" {
                if ($y -lt 2.35) {
                    $xRatio = [Math]::Min(1.0, [Math]::Abs($x) / 1.2707)
                    $floor = 1.02 + 0.92 * [Math]::Pow($xRatio, 2)
                    if ($y -lt $floor) {
                        $y = $floor + [Math]::Max(0, $y - 0.8366) * 0.08
                    }
                }
            }
            "Buzz" {
                $x *= 0.94
                $y = 7.42 + ($y - 7.42) * 0.55
                $z = 0.35 + ($z - 0.35) * 0.94
            }
            "Curtain" {
                if ($z -gt 0.55 -and $y -lt 7.55 -and [Math]::Abs($x) -lt 0.38) {
                    $falloff = 1 - [Math]::Abs($x) / 0.38
                    $side = if ($x -lt 0) { -1 } else { 1 }
                    # Open a gentle center part without lifting the center vertices.
                    # The old 0.72 Y displacement folded the mesh into a visible spike.
                    $x += $side * 0.10 * $falloff
                }
            }
            "Fade" {
                if ($y -lt 7.45) {
                    $fade = [Math]::Min(1.0, [Math]::Max(0, (7.45 - $y) / 0.98))
                    $x *= 1 - 0.16 * $fade
                    $z = 0.35 + ($z - 0.35) * (1 - 0.12 * $fade)
                }
            }
        }

        $output.Add("v $($x.ToString("0.000000", $invariant)) $($y.ToString("0.000000", $invariant)) $($z.ToString("0.000000", $invariant))")
    }

    [IO.File]::WriteAllLines($DestinationPath, $output, [Text.UTF8Encoding]::new($false))
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$bobRoot = Join-Path $sourceRoot "toigo_curled_under_bob"
Resize-Png -Source (Join-Path $bobRoot "GingerHair.png") -Destination (Join-Path $bobRoot "GingerHair-1536.png") -MaximumSize 1536
Resize-Png -Source (Join-Path $bobRoot "BakedHairNORMAL.png") -Destination (Join-Path $bobRoot "BakedHairNORMAL-1536.png") -MaximumSize 1536

Convert-HairModel -SourcePath (Join-Path $bobRoot "bob_curled_under.obj") -DestinationPath (Join-Path $outputRoot "bob-cc0.glb")
Convert-HairModel -SourcePath (Join-Path $sourceRoot "short01\short01.obj") -DestinationPath (Join-Path $outputRoot "short-cc0.glb")

$variants = @(
    @{ Folder = "toigo_curled_under_bob"; Source = "bob_curled_under.obj"; Prepared = "feather-mirrorly.obj"; Shape = "Feather"; Output = "feather-cc0.glb" },
    @{ Folder = "long01"; Source = "long01.obj"; Prepared = "v-cut-mirrorly.obj"; Shape = "V"; Output = "v-cut-cc0.glb" },
    @{ Folder = "long01"; Source = "long01.obj"; Prepared = "u-cut-mirrorly.obj"; Shape = "U"; Output = "u-cut-cc0.glb" },
    @{ Folder = "short02"; Source = "short02.obj"; Prepared = "buzz-cut-mirrorly.obj"; Shape = "Buzz"; Output = "buzz-cut-cc0.glb" },
    @{ Folder = "short03"; Source = "short03.obj"; Prepared = "curtain-bangs-mirrorly.obj"; Shape = "Curtain"; Output = "curtain-bangs-cc0.glb" },
    @{ Folder = "short04"; Source = "short04.obj"; Prepared = "skin-fade-mirrorly.obj"; Shape = "Fade"; Output = "skin-fade-cc0.glb" }
)

foreach ($variant in $variants) {
    $variantRoot = if ($variant.ContainsKey("Root")) { $variant.Root } else { $sourceRoot }
    $folder = Join-Path $variantRoot $variant.Folder
    $prepared = Join-Path $folder $variant.Prepared
    New-HairVariant -SourcePath (Join-Path $folder $variant.Source) -DestinationPath $prepared -Shape $variant.Shape
    Convert-HairModel -SourcePath $prepared -DestinationPath (Join-Path $outputRoot $variant.Output)
}

$modelNames = @(
    "bob-cc0.glb",
    "feather-cc0.glb",
    "v-cut-cc0.glb",
    "u-cut-cc0.glb",
    "short-cc0.glb",
    "buzz-cut-cc0.glb",
    "curtain-bangs-cc0.glb",
    "skin-fade-cc0.glb"
)
Get-Item ($modelNames | ForEach-Object { Join-Path $outputRoot $_ }) |
    Select-Object Name, Length
