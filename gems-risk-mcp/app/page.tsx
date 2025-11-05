export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>GEMs Risk MCP Server</h1>

      <p>
        Model Context Protocol (MCP) server providing access to IFC Global Emerging Markets credit risk data.
      </p>

      <h2>MCP Endpoint</h2>
      <code style={{ background: '#f4f4f4', padding: '0.5rem', display: 'block', borderRadius: '4px' }}>
        {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain'}/api/sse
      </code>

      <h2>Available Tools</h2>
      <ul>
        <li><strong>get_default_rates</strong> - Query default frequencies by region</li>
        <li><strong>get_recovery_rates</strong> - Retrieve recovery rates for defaulted loans</li>
        <li><strong>query_credit_risk</strong> - Get comprehensive credit risk statistics</li>
        <li><strong>get_sector_analysis</strong> - Analyze credit risk by economic sector</li>
        <li><strong>compare_regions</strong> - Compare credit risk metrics across regions</li>
      </ul>

      <h2>Data Source</h2>
      <p>
        Real-time data from <strong>World Bank Data360 IFC_GEM</strong> (Global Emerging Markets Risk Database)
      </p>

      <h2>Test with MCP Inspector</h2>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
        npx @modelcontextprotocol/inspector {typeof window !== 'undefined' ? window.location.origin + '/api/sse' : 'https://your-domain/api/sse'}
      </pre>

      <h2>Use with Claude Desktop</h2>
      <p>Add to your Claude Desktop config:</p>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${typeof window !== 'undefined' ? window.location.origin + '/api/sse' : 'https://your-domain/api/sse'}"
      ]
    }
  }
}`}
      </pre>

      <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #ddd', color: '#666' }}>
        <p>Deployed on Vercel with Next.js App Router</p>
      </footer>
    </main>
  );
}
