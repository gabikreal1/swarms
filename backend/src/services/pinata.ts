import { config } from '../config';
import { log } from '../lib/logger';

export class PinataService {
  private getAuthHeaders(): Record<string, string> {
    const hasJwt = !!config.pinataJwt;
    const hasKeys = !!config.pinataApiKey && !!config.pinataSecretKey;

    if (!hasJwt && !hasKeys) {
      throw new Error('PINATA_JWT or PINATA_API_KEY+PINATA_SECRET_KEY required for IPFS pinning');
    }

    const headers: Record<string, string> = {};

    if (hasJwt) {
      headers['Authorization'] = `Bearer ${config.pinataJwt}`;
    } else {
      headers['pinata_api_key'] = config.pinataApiKey!;
      headers['pinata_secret_api_key'] = config.pinataSecretKey!;
    }

    return headers;
  }

  /** Pin a JSON object to IPFS via Pinata. Returns { uri, cid }. */
  async pinJSON(content: object, name: string): Promise<{ uri: string; cid: string }> {
    const headers = this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: { name },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Pinata pinning failed (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as { IpfsHash: string };
    const cid = result.IpfsHash;
    log.ipfs.info(`pinned ${name}: ipfs://${cid}`);
    return { uri: `ipfs://${cid}`, cid };
  }

  /** Convert an ipfs:// URI to a gateway HTTP URL. */
  getGatewayUrl(ipfsUri: string): string {
    const cid = ipfsUri.replace(/^ipfs:\/\//, '');
    return `${config.pinataGatewayUrl}/ipfs/${cid}`;
  }

  /** Fetch and parse JSON from an IPFS URI (ipfs://, http(s)://, or data: URI). */
  async fetchJSON(uri: string): Promise<any> {
    let url = uri;

    if (uri.startsWith('ipfs://')) {
      url = this.getGatewayUrl(uri);
    }

    if (url.startsWith('data:')) {
      const commaIdx = url.indexOf(',');
      if (commaIdx === -1) return null;
      const data = url.slice(commaIdx + 1);
      return JSON.parse(Buffer.from(data, 'base64').toString());
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`IPFS fetch failed (${response.status}): ${response.statusText}`);
    }
    return response.json();
  }
}

export const pinata = new PinataService();
