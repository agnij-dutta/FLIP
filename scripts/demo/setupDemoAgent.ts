/**
 * Demo Agent Setup Script
 * 
 * Sets up demo agent with XRPL wallet and configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Agent configuration template
const AGENT_CONFIG_TEMPLATE = `# FLIP Agent Configuration (Demo)

flare:
  rpc_url: "https://coston2-api.flare.network/ext/C/rpc"
  chain_id: 114
  flip_core_address: "0x1151473d15F012d0Dd54f8e707dB6708BD25981F"
  escrow_vault_address: "0x96f78a441cd5F495BdE362685B200c285e445073"

xrpl:
  testnet_ws: "wss://s.altnet.rippletest.net:51233"
  testnet_rpc: "https://s.altnet.rippletest.net:51233"
  # WARNING: Replace with your actual XRPL testnet wallet seed
  wallet_seed: "{{XRPL_SEED}}"

fdc:
  verifier_url: "https://verifier-coston2.flare.network"
  da_layer_url: "https://coston2-api.flare.network/api/v0/fdc"
  api_key: ""

agent:
  polling_interval: 10
  max_payment_retries: 3
  payment_retry_delay: 5
  fdc_timeout: 300
  min_xrp_balance: 10000000
`;

async function setupDemoAgent() {
  const xrplSeed = process.env.XRPL_WALLET_SEED || "";

  if (!xrplSeed) {
    console.log("⚠️  XRPL_WALLET_SEED not set in environment");
    console.log("\nTo set up the agent:");
    console.log("1. Create an XRPL testnet wallet (use Xaman or xrpl.js)");
    console.log("2. Fund it with testnet XRP from: https://xrpl.org/xrp-testnet-faucet.html");
    console.log("3. Set XRPL_WALLET_SEED in .env file");
    console.log("4. Run this script again\n");
    return;
  }

  const agentDir = path.join(__dirname, '../../agent');
  const configPath = path.join(agentDir, 'config.yaml');

  // Create agent directory if it doesn't exist
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  // Write config file
  const config = AGENT_CONFIG_TEMPLATE.replace('{{XRPL_SEED}}', xrplSeed);
  fs.writeFileSync(configPath, config);

  console.log("✅ Agent configuration created:");
  console.log(`   ${configPath}\n`);

  console.log("📝 Next steps:");
  console.log("1. Review agent/config.yaml");
  console.log("2. Ensure XRPL wallet is funded with testnet XRP");
  console.log("3. Start agent: cd agent && go run main.go\n");
}

// CLI usage
if (require.main === module) {
  setupDemoAgent()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { setupDemoAgent };

