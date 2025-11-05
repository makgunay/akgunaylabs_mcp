#!/usr/bin/env node

// Test script for Data360 API integration

const DATA360_API_BASE = "https://data360api.worldbank.org";
const IFC_GEM_DATASET = "IFC_GEM";

async function testAPI() {
  console.log("🧪 Testing World Bank Data360 API Integration\n");
  console.log("=" .repeat(60));

  // Test 1: Fetch default rates for all regions
  console.log("\n📊 Test 1: Fetching Default Rates (ADR metric)");
  console.log("-".repeat(60));

  try {
    const url = `${DATA360_API_BASE}/data360/data?DATABASE_ID=${IFC_GEM_DATASET}&$filter=METRIC eq 'ADR'`;
    console.log(`URL: ${url}\n`);

    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Records received: ${data.count}`);

    // Get most recent data per region
    const regionData = new Map();
    for (const record of data.value) {
      const region = record.REF_AREA;
      const year = parseInt(record.TIME_PERIOD);
      const rate = parseFloat(record.OBS_VALUE);

      if (!regionData.has(region) || regionData.get(region).year < year) {
        regionData.set(region, { year, rate });
      }
    }

    console.log("\n📈 Latest Default Rates by Region:");
    const regionNames = {
      "_T": "Global Emerging Markets",
      "EAS": "East Asia & Pacific",
      "ECS": "Europe & Central Asia",
      "LCN": "Latin America & Caribbean",
      "MEA": "Middle East & North Africa",
      "SAS": "South Asia",
      "SSF": "Sub-Saharan Africa"
    };

    for (const [code, { year, rate }] of regionData.entries()) {
      const name = regionNames[code] || code;
      console.log(`  ${name.padEnd(30)} ${year}: ${rate.toFixed(2)}%`);
    }
  } catch (error) {
    console.error(`❌ Test 1 failed: ${error.message}`);
  }

  // Test 2: Fetch loan counts
  console.log("\n\n📊 Test 2: Fetching Loan Counts (CP metric)");
  console.log("-".repeat(60));

  try {
    const url = `${DATA360_API_BASE}/data360/data?DATABASE_ID=${IFC_GEM_DATASET}&$filter=METRIC eq 'CP' and REF_AREA eq '_T'`;
    console.log(`URL: ${url}\n`);

    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Records received: ${data.count}`);

    // Get latest value
    const latest = data.value.sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
    if (latest) {
      console.log(`\n📊 Latest Global Loan Count:`);
      console.log(`  Year: ${latest.TIME_PERIOD}`);
      console.log(`  Count: ${parseFloat(latest.OBS_VALUE).toLocaleString()} loans`);
    }
  } catch (error) {
    console.error(`❌ Test 2 failed: ${error.message}`);
  }

  // Test 3: Fetch loan volumes
  console.log("\n\n📊 Test 3: Fetching Loan Volumes (SA metric)");
  console.log("-".repeat(60));

  try {
    const url = `${DATA360_API_BASE}/data360/data?DATABASE_ID=${IFC_GEM_DATASET}&$filter=METRIC eq 'SA' and REF_AREA eq '_T'`;
    console.log(`URL: ${url}\n`);

    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Records received: ${data.count}`);

    // Get latest value
    const latest = data.value.sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
    if (latest) {
      const volumeMillions = parseFloat(latest.OBS_VALUE);
      const volumeBillions = volumeMillions / 1000;
      console.log(`\n💰 Latest Global Loan Volume:`);
      console.log(`  Year: ${latest.TIME_PERIOD}`);
      console.log(`  Volume: €${volumeMillions.toLocaleString()} million`);
      console.log(`  Volume: €${volumeBillions.toFixed(1)} billion`);
    }
  } catch (error) {
    console.error(`❌ Test 3 failed: ${error.message}`);
  }

  // Test 4: Test specific region (East Asia)
  console.log("\n\n📊 Test 4: Fetching East Asia Default Rates");
  console.log("-".repeat(60));

  try {
    const url = `${DATA360_API_BASE}/data360/data?DATABASE_ID=${IFC_GEM_DATASET}&$filter=METRIC eq 'ADR' and REF_AREA eq 'EAS'`;
    console.log(`URL: ${url}\n`);

    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Records received: ${data.count}`);

    // Get latest value
    const latest = data.value.sort((a, b) => parseInt(b.TIME_PERIOD) - parseInt(a.TIME_PERIOD))[0];
    if (latest) {
      console.log(`\n📈 Latest East Asia & Pacific Default Rate:`);
      console.log(`  Year: ${latest.TIME_PERIOD}`);
      console.log(`  Default Rate: ${parseFloat(latest.OBS_VALUE).toFixed(2)}%`);
    }
  } catch (error) {
    console.error(`❌ Test 4 failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ API Integration Tests Complete!");
  console.log("=".repeat(60));
}

// Run tests
testAPI().catch(error => {
  console.error("\n❌ Test suite failed:", error);
  process.exit(1);
});
