param(
    [Parameter(Mandatory=$true)][string]$Baseline,
    [Parameter(Mandatory=$true)][string]$Modified,
    [Parameter(Mandatory=$true)][string]$Output,
    [Parameter(Mandatory=$true)][string]$Library
)
$ErrorActionPreference='Stop'
$Library=(Resolve-Path $Library).Path
$env:PATH="$Library/runtimes/win-x64/native;$env:PATH"
[Runtime.InteropServices.NativeLibrary]::Load("$Library/runtimes/win-x64/native/nironcompress.dll")|Out-Null
[Reflection.Assembly]::LoadFrom("$Library/UPK.Utils.dll")|Out-Null
Add-Type -TypeDefinition 'public sealed class LIDComparisonProgress : UPK.Utils.Adapters.IObjectComparisonProgressNotifier { public void SetBusyness(int value) {} public void SetProgress(int value) {} }' -ReferencedAssemblies "$Library/UPK.Utils.dll" -IgnoreWarnings -WarningAction SilentlyContinue
function Load-Package([string]$file) {
    $file=(Resolve-Path $file).Path
    $folder=[UPK.Utils.GameProfiles.PackageFolder]::Create((Split-Path $file -Parent),0)
    $game=[UPK.Utils.GameProfiles.Game]::FromXmlFile([IO.FileInfo]"$Library/GameProfiles/LetItDie.xml")
    $game.SetPackageFolders([UPK.Utils.GameProfiles.PackageFolder[]]@($folder))
    $game.Initialize($game)
    $p=[UPK.Utils.Packages.UPKPackage]::GetPackage([IO.FileInfo]$file,$folder)
    $p.ReadHeader([UPK.Utils.GameProfiles.Platforms]::PC,[UPK.Utils.Compressions.CompressionFlag]::LZO,'')
    return @{package=$p;game=$game}
}
$old=Load-Package $Baseline
$new=Load-Package $Modified
$descriptors=[UPK.Utils.ObjectDescriptors.ObjectDescriptors]::CreateDefault()
$adapter=[UPK.Utils.Adapters.PackageAdapter]::new($old.package,$descriptors,$old.game)
$patch=$adapter.CreatePackagePatch($new.package,[LIDComparisonProgress]::new())
$outputPath=[IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Path (Split-Path $outputPath -Parent) -Force|Out-Null
if(Test-Path $outputPath){throw 'Output exists; refusing overwrite.'}
$patch.Write($outputPath,$new.package.Profile)
$check=[UPK.Utils.GamePatches.PackagePatch]::new()
$check.Read($outputPath,$new.package.Profile)
foreach($update in $check.ObjectUpdates) {
    $range=$new.package.ObjectExports[$update.ObjectExportIndex].SerializedData
    $bytes=$new.package.CreateDataReader($range.Offset).ReadBytes($range.Size)
    if([Convert]::ToBase64String($bytes) -ne [Convert]::ToBase64String([byte[]]$update.SerializedData)) {
        throw "Export verification failed for object $($update.ObjectExportIndex): expected modified payload."
    }
}
[pscustomobject]@{path=$outputPath;objects=@($check.ObjectUpdates).Count;size=(Get-Item $outputPath).Length} | ConvertTo-Json
