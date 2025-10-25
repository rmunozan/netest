const ping = require('ping');
const FastSpeedtest = require('fast-speedtest-api');
const dns = require('dns');

// ================= Configuration =================
const config = {
  // DNS Servers (optimized for Europe)
  dnsServers: [
    { host: '1.1.1.1', name: 'Cloudflare' },
    { host: '8.8.8.8', name: 'Google' },
    { host: '9.9.9.9', name: 'Quad9' },
    { host: '194.146.28.66', name: 'DNS.SB (DE)' },
    { host: '89.233.43.71', name: 'UncensoredDNS (DK)' },
    { host: '45.90.28.0', name: 'NextDNS' },
    { host: '94.140.14.14', name: 'AdGuard' },
  ],

  // Speedtest configuration
  speedTestConfig: {
    token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm", // Replace with your token
    verbose: false,
    timeout: 10000, // 10 seconds
    unit: FastSpeedtest.UNITS.Mbps,
  },

  // Testing parameters
  pingCount: 20,
};

// ================= Core Functions =================
class NetworkAnalyzer {
  // DNS Performance Testing
  static async testDnsPerformance(server) {
    const latencies = [];
    let packetLoss = 0;

    for (let i = 0; i < config.pingCount; i++) {
      try {
        const res = await ping.promise.probe(server.host);
        if (res.alive) {
          latencies.push(parseFloat(res.time));
        } else {
          packetLoss++;
        }
      } catch {
        packetLoss++;
      }
    }

    if (latencies.length === 0) return null;

    return {
      name: server.name,
      host: server.host,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      jitter: this.calculateJitter(latencies),
      packetLoss: (packetLoss / config.pingCount) * 100,
      rawLatencies: latencies,
    };
  }

  // Speed Test (Download Speed Only)
  static async runSpeedTest() {
    const speedtest = new FastSpeedtest(config.speedTestConfig);

    try {
      const downloadSpeed = await speedtest.getSpeed();
      return {
        download: downloadSpeed,
      };
    } catch (error) {
      console.log("Speed test failed. Make sure you have a valid token.");
      return null;
    }
  }

  // Network Diagnostics
  static async runNetworkChecks() {
    return {
      // DNS resolution test
      dnsResolution: await this.testDnsResolution(),
    };
  }

  // ================= Helpers =================
  static calculateJitter(latencies) {
    return (
      latencies.slice(1).reduce((acc, curr, i) => acc + Math.abs(curr - latencies[i]), 0) /
      (latencies.length - 1)
    );
  }

  static async testDnsResolution() {
    const testDomains = ['google.com', 'cloudflare.com', 'example.com'];
    const results = {};

    for (const domain of testDomains) {
      const start = Date.now();
      try {
        await dns.promises.resolve(domain);
        results[domain] = Date.now() - start;
      } catch {
        results[domain] = null;
      }
    }
    return results;
  }
}

// ================= Main Execution =================
async function main() {
  console.log("Starting comprehensive network analysis...\n");

  // Phase 1: DNS Performance Analysis
  console.log("=== DNS Server Analysis ===");
  const dnsResults = [];
  for (const server of config.dnsServers) {
    process.stdout.write(`Testing ${server.name.padEnd(20)} (${server.host})... `);
    const result = await NetworkAnalyzer.testDnsPerformance(server);
    if (result) {
      console.log(`${result.avgLatency.toFixed(1)}ms | Jitter: ${result.jitter.toFixed(1)}ms | Loss: ${result.packetLoss.toFixed(1)}%`);
      dnsResults.push(result);
    } else {
      console.log("Failed");
    }
  }

  // Phase 2: Speed Test (Download Speed Only)
  console.log("\n=== Bandwidth Analysis ===");
  const speedTest = await NetworkAnalyzer.runSpeedTest();
  if (speedTest) {
    console.log(`Download Speed: ${speedTest.download.toFixed(1)} Mbps`);
  }

  // Phase 3: Network Health Check
  console.log("\n=== Network Health Check ===");
  const healthCheck = await NetworkAnalyzer.runNetworkChecks();
  console.log("DNS Resolution Times:");
  for (const [domain, time] of Object.entries(healthCheck.dnsResolution)) {
    console.log(`- ${domain.padEnd(12)}: ${time || 'Failed'}ms`);
  }

  // Final Recommendations
  console.log("\n=== Recommendations ===");
  const bestDns = dnsResults.sort((a, b) =>
    a.avgLatency - b.avgLatency || a.jitter - b.jitter
  )[0];

  console.log(`Recommended DNS Server: ${bestDns.name} (${bestDns.host})`);
  console.log(`- Average Latency: ${bestDns.avgLatency.toFixed(1)}ms`);
  console.log(`- Network Jitter:  ${bestDns.jitter.toFixed(1)}ms`);
  console.log(`- Packet Loss:     ${bestDns.packetLoss.toFixed(1)}%`);

  if (speedTest) {
    console.log("\nBandwidth Assessment:");
    console.log(speedTest.download < 50 ? "⚠️  Download speed may affect streaming/updates" : "✅ Good download performance");
  }
}

// Run the analysis
main().catch(console.error);