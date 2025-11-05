#!/usr/bin/env node

/**
 * Test script for deployed MCP on Vercel
 * Tests the GEMs Risk MCP tools
 */

const MCP_URL = 'https://akgunaylabs-mcp.vercel.app/api/mcp';

async function testMCP() {
  console.log('🧪 Testing GEMs Risk MCP');
  console.log(`📍 URL: ${MCP_URL}\n`);

  // Test 1: Initialize connection
  console.log('Test 1: Initialize MCP connection');
  try {
    const initResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      })
    });

    if (!initResponse.ok) {
      console.log(`❌ HTTP ${initResponse.status}: ${initResponse.statusText}`);
      const text = await initResponse.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      return;
    }

    const initData = await initResponse.json();
    console.log('✅ Initialize successful');
    console.log(`Server: ${initData.result?.serverInfo?.name || 'Unknown'}`);
    console.log(`Version: ${initData.result?.serverInfo?.version || 'Unknown'}\n`);
  } catch (error) {
    console.log(`❌ Initialize failed: ${error.message}\n`);
    return;
  }

  // Test 2: List available tools
  console.log('Test 2: List available tools');
  try {
    const toolsResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 2
      })
    });

    const toolsData = await toolsResponse.json();
    if (toolsData.result?.tools) {
      console.log(`✅ Found ${toolsData.result.tools.length} tools:`);
      toolsData.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      console.log();
    } else {
      console.log('❌ No tools found\n');
    }
  } catch (error) {
    console.log(`❌ List tools failed: ${error.message}\n`);
  }

  // Test 3: Call get_default_rates for global
  console.log('Test 3: Call get_default_rates (global)');
  try {
    const callResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_default_rates',
          arguments: {
            region: 'global'
          }
        },
        id: 3
      })
    });

    const callData = await callResponse.json();
    if (callData.result?.content) {
      console.log('✅ Tool call successful');
      const text = callData.result.content[0]?.text || '';
      // Print first 300 characters
      console.log(text.substring(0, 300) + '...\n');
    } else if (callData.error) {
      console.log(`❌ Tool call failed: ${callData.error.message}\n`);
    } else {
      console.log('❌ Unexpected response format\n');
    }
  } catch (error) {
    console.log(`❌ Tool call failed: ${error.message}\n`);
  }

  // Test 4: Call compare_regions
  console.log('Test 4: Call compare_regions (default rates)');
  try {
    const compareResponse = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'compare_regions',
          arguments: {
            metric: 'default-rate'
          }
        },
        id: 4
      })
    });

    const compareData = await compareResponse.json();
    if (compareData.result?.content) {
      console.log('✅ Tool call successful');
      const text = compareData.result.content[0]?.text || '';
      console.log(text.substring(0, 400) + '...\n');
    } else if (compareData.error) {
      console.log(`❌ Tool call failed: ${compareData.error.message}\n`);
    } else {
      console.log('❌ Unexpected response format\n');
    }
  } catch (error) {
    console.log(`❌ Tool call failed: ${error.message}\n`);
  }

  console.log('🎉 Testing complete!');
  console.log('\n📖 To test interactively, use:');
  console.log(`   npx @modelcontextprotocol/inspector ${MCP_URL}`);
  console.log('\n🖥️  To use with Claude Desktop, add to config:');
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "gems-risk": {');
  console.log('         "command": "npx",');
  console.log('         "args": ["-y", "mcp-remote", "' + MCP_URL + '"]');
  console.log('       }');
  console.log('     }');
  console.log('   }');
}

testMCP().catch(console.error);
