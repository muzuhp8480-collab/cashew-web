param(
    [int]$Port = 8080,
    [string]$Root = "C:\cashew web"
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "======================================================="
Write-Host " ROYAL CASHEW 3D SCROLL SERVER ACTIVE"
Write-Host " URL: http://localhost:$Port/"
Write-Host " Root: $Root"
Write-Host "======================================================="

$mimeTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".webp" = "image/webp"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".woff2"= "font/woff2"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $rawUrl = [System.Uri]::UnescapeDataString($request.RawUrl.Split('?')[0])
            if ($rawUrl -eq '/' -or [string]::IsNullOrWhiteSpace($rawUrl)) {
                $rawUrl = '/index.html'
            }

            $filePath = Join-Path $Root $rawUrl.TrimStart('/')
            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                $response.ContentType = $contentType
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.Headers.Add("Cache-Control", "public, max-age=3600")

                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.ContentLength64 = $msg.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($msg, 0, $msg.Length)
                }
            }
        } catch {
            Write-Verbose "Request error: $_"
        } finally {
            try { $response.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
}
