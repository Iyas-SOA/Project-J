const fs = require('fs');
const { bech32 } = require('@scure/base');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { SuiClient } = require('@mysten/sui.js/client');

const SUI_RPC_URL = 'https://fullnode.mainnet.sui.io:443';
const MINT_API_URL = 'https://coj-gdc2025-api.cmsd.dev/mint';

async function processSuiWallet(privateKey, client) {
    try {
        const decoded = bech32.decode(privateKey);
        const bytes = new Uint8Array(bech32.fromWords(decoded.words));
        
        if (bytes.length !== 33) {
            throw new Error(`Invalid key length: ${bytes.length} bytes`);
        }
        const rawPrivateKey = bytes.slice(1);
        
        const keypair = Ed25519Keypair.fromSecretKey(rawPrivateKey);
        const address = keypair.toSuiAddress();

        // Check balance
        const balance = await client.getBalance({ owner: address });
        const suiAmount = balance.totalBalance / 1e9;
        console.log(`\n${address}: ${suiAmount.toFixed(2)} SUI (${balance.totalBalance} MIST)`);

        // Sign message
        const message = `The wallet address ${address} is currently doing free minting now which has no gas fees or costs..`;
        const messageBytes = new TextEncoder().encode(message);
        const signature = await keypair.sign(messageBytes);
        const signatureBase64 = Buffer.from(signature).toString('base64');

        // Send mint request
        const response = await fetch(MINT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                signature: signatureBase64,
                message: message,
                network: "mainnet"
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        console.log('Mint request successful:');
        console.log('Status:', responseData.status);
        console.log('Message:', responseData.message);
        console.log('Request Hash:', responseData.requestHash);
        console.log('Queue Position:', responseData.queuePosition);

    } catch (error) {
        console.error(`Error processing key ${privateKey}: ${error.message}`);
    }
}

async function checkSuiBalancesAndMint() {
    const privateKeys = fs.readFileSync('private_keys.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('suiprivkey1'));

    if (privateKeys.length === 0) {
        console.log('No valid private keys found in private_keys.txt');
        return;
    }

    const client = new SuiClient({ url: SUI_RPC_URL });

    for (const privateKey of privateKeys) {
        await processSuiWallet(privateKey, client);
    }
}

checkSuiBalancesAndMint().catch(console.error);