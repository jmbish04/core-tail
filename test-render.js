import Cloudflare from "cloudflare";

async function run() {
  const client = new Cloudflare({ apiToken: process.env.CF_BROWSER_RENDER_TOKEN });
  const result = await client.browserRendering.markdown.create({
    account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
    url: "https://core-tail.hacolby.workers.dev"
  });
  console.log(result);
}

run().catch(console.error);
