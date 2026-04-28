/**
 * Generic helper to fetch a secret value.
 * 
 * Precedence:
 * 1. KV Config (Metadata/Pointer) -> Secret Store (Value)
 * 2. Secrets Store (Direct Binding fallback)
 * 3. Environment Variable (Legacy/Local)
 * 
 * CAUTION: This should ONLY be used for operations where the worker is retrieving a secret
 * from the secret-store in order to set the value inside of a GitHub repo, or other external provisioning.
 * 
 * For standard Worker operations (using the key itself), use `env.{SECRET_BINDING_NAME}.get()` directly.
 */
export async function getSecret(env: Env, key: string): Promise<string | undefined> {
    // Check Secrets Store or Env Var Binding (Legacy behavior compliance)
    const envVal = (env as any)[key];
    if (envVal && typeof envVal?.get === 'function') {
        const val = await envVal.get();
        return val;
    }
    return envVal;
}

export async function getWorkerApiKey(env: Env): Promise<string | undefined> {
    if (env.WORKER_API_KEY) {
        return typeof env.WORKER_API_KEY === 'string' 
            ? env.WORKER_API_KEY 
            : await (env.WORKER_API_KEY as any).get();
    }
    return getSecret(env, "WORKER_API_KEY");
}

/**
 * Helper to fetch the AGENTIC_WORKER_API_KEY from the Secrets Store.
 * This key is exclusively for agent/automation access to the frontend.
 * It supports the ?AGENT_AUTH= URL query param auth path, which is NOT
 * available to the regular WORKER_API_KEY.
 */
export async function getAgenticWorkerApiKey(env: Env): Promise<string | undefined> {
    if (env.AGENTIC_WORKER_API_KEY) {
        return typeof env.AGENTIC_WORKER_API_KEY === 'string'
            ? env.AGENTIC_WORKER_API_KEY
            : await env.AGENTIC_WORKER_API_KEY.get();
    }
    return getSecret(env, "AGENTIC_WORKER_API_KEY");
}

// export async function getGithubToken(env: Env): Promise<string | undefined> {
//     if (env.GITHUB_PERSONAL_ACCESS_TOKEN) {
//         return typeof env.GITHUB_PERSONAL_ACCESS_TOKEN === 'string'
//             ? env.GITHUB_PERSONAL_ACCESS_TOKEN
//             : await (env.GITHUB_PERSONAL_ACCESS_TOKEN as any).get();
//     }
//     return getSecret(env, "GITHUB_PERSONAL_ACCESS_TOKEN");
// }


export async function getCloudflareApiToken(env: Env): Promise<string | undefined> {
    if (env.CLOUDFLARE_WRANGLER_API_TOKEN) {
        return typeof env.CLOUDFLARE_WRANGLER_API_TOKEN === 'string'
            ? env.CLOUDFLARE_WRANGLER_API_TOKEN
            : await (env.CLOUDFLARE_WRANGLER_API_TOKEN as any).get();
    }
    return getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN");
}

export async function getCloudflareAccountId(env: Env): Promise<string | undefined> {
    if (env.CLOUDFLARE_ACCOUNT_ID) {
        return typeof env.CLOUDFLARE_ACCOUNT_ID === 'string'
            ? env.CLOUDFLARE_ACCOUNT_ID
            : await (env.CLOUDFLARE_ACCOUNT_ID as any).get();
    }
    return getSecret(env, "CLOUDFLARE_ACCOUNT_ID");
}



/**
 * Wraps a raw PKCS#1 RSAPrivateKey DER byte array into a PKCS#8 PrivateKeyInfo DER envelope.
 */
function wrapPkcs1InPkcs8(pkcs1Der: Uint8Array): ArrayBuffer {
    const version = new Uint8Array([0x02, 0x01, 0x00]);
    const rsaOidBytes = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
    const algorithmIdentifier = encodeSequence(rsaOidBytes);
    const privateKeyOctet = encodeTag(0x04, pkcs1Der);
    const privateKeyInfo = encodeSequence(concatBytes(version, algorithmIdentifier, privateKeyOctet));
    return privateKeyInfo.buffer.slice(privateKeyInfo.byteOffset, privateKeyInfo.byteOffset + privateKeyInfo.byteLength) as ArrayBuffer;
}

function encodeLength(len: number): Uint8Array {
    if (len < 128) return new Uint8Array([len]);
    if (len < 256) return new Uint8Array([0x81, len]);
    return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function encodeTag(tag: number, data: Uint8Array): Uint8Array {
    return concatBytes(new Uint8Array([tag]), encodeLength(data.length), data);
}

function encodeSequence(data: Uint8Array): Uint8Array {
    return encodeTag(0x30, data);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
    return out;
}

/**
 * Helper to fetch the GitHub Webhook Secret.
 * Assuming this is also a Secrets Store binding.
 */
export async function getGitHubWebhookSecret(env: Env): Promise<string> {
    // This often maps to WORKER_API_KEY in this project
    if (env.WORKER_API_KEY) {
        const secret = typeof env.WORKER_API_KEY === 'string' 
            ? env.WORKER_API_KEY 
            : await (env.WORKER_API_KEY as any).get();
        if (secret) return secret;
    }

    const secret = await getSecret(env, "WORKER_API_KEY");
    if (!secret) {
        throw new Error("Missing WORKER_API_KEY in Secrets Store");
    }
    return secret;
}
