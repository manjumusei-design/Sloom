$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class CredMan {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, EntryPoint = "CredReadW", SetLastError = true)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr buffer);

  public static string ReadSecret(string target) {
    IntPtr credPtr;
    if (!CredRead(target, 1, 0, out credPtr)) return null;
    try {
      var cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
      return Marshal.PtrToStringUni(cred.CredentialBlob, cred.CredentialBlobSize / 2);
    } finally {
      CredFree(credPtr);
    }
  }
}
"@

function Read-Secret {
  param([string]$service, [string]$prefix)
  $value = [CredMan]::ReadSecret($service)
  if ($null -eq $value) {
    Write-Error "MISSING: no Credential Manager entry for '$service'. Store it once with: cmdkey /generic:$service /user:sloom /pass:<token>"
  }
  $value = $value.TrimEnd([char]0).Trim()
  if (-not $value.StartsWith($prefix)) {
    Write-Error "INVALID: Credential Manager entry '$service' does not start with '$prefix'."
  }
  return $value
}

$env:SLACK_APP_TOKEN = Read-Secret "sloom-slack-app-token" "xapp-"
$env:SLACK_BOT_TOKEN = Read-Secret "sloom-slack-bot-token" "xoxb-"

Write-Host "[dev] app token: present (xapp-, $($env:SLACK_APP_TOKEN.Length) chars)"
Write-Host "[dev] bot token: present (xoxb-, $($env:SLACK_BOT_TOKEN.Length) chars)"
Write-Host "[dev] starting bot (Socket Mode)"

npx tsx watch src/index.ts
