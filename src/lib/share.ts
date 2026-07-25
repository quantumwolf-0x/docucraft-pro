export function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  // Convert standard base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64UrlDecode(base64Url: string): Uint8Array {
  // Convert base64url to standard base64
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '='
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function compressAndEncode(jsonStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);

  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const response = new Response(cs.readable);
  const compressedBuffer = await response.arrayBuffer();

  return base64UrlEncode(compressedBuffer);
}

export async function decodeAndDecompress(encodedStr: string): Promise<string> {
  const compressedData = base64UrlDecode(encodedStr);

  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(compressedData as any);
  writer.close();

  const response = new Response(ds.readable);
  const decompressedBuffer = await response.arrayBuffer();

  const decoder = new TextDecoder();

  return decoder.decode(decompressedBuffer);
}
