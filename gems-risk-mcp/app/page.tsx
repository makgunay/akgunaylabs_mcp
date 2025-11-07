export default function Home() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mcp.akgunaylabs.io';
  const mcpEndpoint = `${baseUrl}/api/gems-risk/mcp`;

  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      lineHeight: '1.6'
    }}>
      <header style={{ borderBottom: '2px solid #0066cc', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ color: '#0066cc', marginBottom: '0.5rem' }}>IFC GEMs Risk MCP Server</h1>
        <p style={{ fontSize: '1.2rem', color: '#555', margin: 0 }}>
          Access emerging markets credit risk data through your AI assistant
        </p>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>🎯 What It Does</h2>
        <p>
          This Model Context Protocol (MCP) server provides real-time access to the <strong>World Bank's IFC Global Emerging Markets (GEMs) Risk Database</strong>—a comprehensive source of credit risk analytics for emerging market lending.
        </p>
        <p>
          Query credit risk data across <strong>three economic sectors</strong>:
        </p>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Sovereign</strong> - National government debt and sovereign bonds (lowest risk: 0.77% default rate)</li>
          <li><strong>Public Sector</strong> - Sub-sovereign entities and state-owned enterprises</li>
          <li><strong>Private Sector</strong> - Corporate and private sector lending (largest dataset: 2,853 observations)</li>
        </ul>
        <p>
          Analyze <strong>7 global regions</strong>, <strong>15 economic sectors</strong>, and <strong>40+ years</strong> of credit risk data (1984-2024).
        </p>
      </section>

      <section style={{ marginBottom: '2rem', background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>🔧 How to Connect</h2>

        <h3 style={{ fontSize: '1.1rem', color: '#555' }}>MCP Endpoint</h3>
        <code style={{
          background: '#fff',
          padding: '0.75rem',
          display: 'block',
          borderRadius: '4px',
          border: '1px solid #ddd',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}>
          {mcpEndpoint}
        </code>

        <h3 style={{ fontSize: '1.1rem', color: '#555', marginTop: '1.5rem' }}>Claude Desktop Configuration</h3>
        <p style={{ margin: '0.5rem 0' }}>
          Add to your config file (<code>~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS):
        </p>
        <pre style={{
          background: '#fff',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          border: '1px solid #ddd',
          fontSize: '0.85rem'
        }}>
{`{
  "mcpServers": {
    "gems-risk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${mcpEndpoint}"
      ]
    }
  }
}`}
        </pre>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>📊 Available Tools (9 total)</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>1. get_default_rates</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Query average default frequencies by region</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "What's the default rate in Latin America?"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>2. get_recovery_rates</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Retrieve recovery rates for defaulted loans</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "What's the recovery rate for sovereign debt in MENA?"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>3. query_credit_risk</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Comprehensive credit risk profile with default, recovery, and expected loss</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Show me complete credit risk for East Asia"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>4. compare_regions</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Compare default and recovery rates across all regions</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Compare default rates across all regions"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>5. get_sector_analysis</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Analyze credit performance by economic sector</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Default rate for infrastructure in East Asia?"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>6. get_project_type_analysis</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Compare credit risk across project types</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Compare greenfield vs expansion projects"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>7. get_time_series</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Track default and recovery rates over time</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Show 10-year default rate trend for South Asia"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>8. get_seniority_analysis</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Compare senior vs subordinated debt recovery rates</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Senior vs subordinated debt recovery rates"</code>
          </div>

          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong style={{ color: '#0066cc' }}>9. query_multidimensional</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>Advanced queries across sector, project type, and seniority</p>
            <code style={{ fontSize: '0.85rem', color: '#666' }}>Example: "Senior infrastructure loans in Latin America"</code>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>🌍 Coverage</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', color: '#0066cc', marginBottom: '0.5rem' }}>Geographic Regions (7)</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Global</li>
              <li>East Asia & Pacific</li>
              <li>Latin America & Caribbean</li>
              <li>Sub-Saharan Africa</li>
              <li>South Asia</li>
              <li>Middle East & North Africa</li>
              <li>Europe & Central Asia</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', color: '#0066cc', marginBottom: '0.5rem' }}>Economic Sectors (15)</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>Infrastructure</li>
              <li>Manufacturing</li>
              <li>Financial Institutions</li>
              <li>Oil & Gas</li>
              <li>Agriculture</li>
              <li>+ 10 more sectors</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', color: '#0066cc', marginBottom: '0.5rem' }}>Data Quality</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              <li>40+ years (1984-2024)</li>
              <li>8,000+ observations</li>
              <li>Real-time API</li>
              <li>Authoritative IFC data</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem', background: '#e8f4f8', padding: '1.5rem', borderRadius: '8px', border: '1px solid #b3d9e8' }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>💡 Use Cases</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <strong style={{ color: '#0066cc' }}>Financial Analysts</strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>Portfolio risk assessment, regional comparison, sector analysis, country risk evaluation</p>
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>Development Finance</strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>Project evaluation, seniority analysis, infrastructure project finance, development bank lending</p>
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>Research & Education</strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>Emerging markets research, historical credit cycle analysis, risk modeling with real-world data</p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>📈 Data Source</h2>
        <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 1rem 0' }}>
            <strong>World Bank Data360 API</strong> - IFC_GEM (Global Emerging Markets Risk Database)
          </p>
          <ul style={{ margin: 0, lineHeight: '1.8' }}>
            <li><strong>Authority:</strong> International Finance Corporation (IFC) - World Bank Group</li>
            <li><strong>Coverage:</strong> 40+ years of emerging market credit data (1984-2024)</li>
            <li><strong>Data Points:</strong> 8,000+ default and recovery observations</li>
            <li><strong>Access:</strong> Real-time API, no authentication required, publicly available</li>
            <li><strong>Privacy:</strong> Aggregated regional/sectoral statistics, no personal data</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>🔍 Understanding the Metrics</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: '#fff7e6', borderRadius: '6px', border: '1px solid #ffd666' }}>
            <strong style={{ color: '#d48806' }}>Default Rate (ADR)</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Percentage of loans that default. Lower is better. Range: 0.5% - 5% for emerging markets.
            </p>
          </div>

          <div style={{ padding: '1rem', background: '#e6f7ff', borderRadius: '6px', border: '1px solid #91d5ff' }}>
            <strong style={{ color: '#096dd9' }}>Recovery Rate (ARR)</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Percentage recovered when defaults occur. Higher is better. Range: 50% - 95% for emerging markets.
            </p>
          </div>

          <div style={{ padding: '1rem', background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
            <strong style={{ color: '#52c41a' }}>Expected Loss</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Combined measure: Default Rate × (1 - Recovery Rate). Overall portfolio risk. Lower is better.
            </p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#333' }}>💬 Example Queries</h2>
        <p>Once connected, ask Claude natural questions like:</p>
        <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
          <ul style={{ margin: 0, lineHeight: '2' }}>
            <li>"What's the default rate in Latin America?"</li>
            <li>"Compare sovereign vs corporate default risk in Sub-Saharan Africa"</li>
            <li>"Show me the 10-year default rate trend for global emerging markets"</li>
            <li>"What's the recovery rate for senior infrastructure debt in MENA?"</li>
            <li>"Which region has the highest recovery rates for private sector lending?"</li>
            <li>"Compare greenfield vs expansion projects for credit risk"</li>
          </ul>
        </div>
      </section>

      <section style={{ marginBottom: '2rem', background: '#f0f5ff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #adc6ff' }}>
        <h2 style={{ color: '#333', marginTop: 0 }}>📖 Version Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
          <div><strong>Version:</strong> 2.0</div>
          <div><strong>Tools:</strong> 9</div>
          <div><strong>Regions:</strong> 7</div>
          <div><strong>Sectors:</strong> 15</div>
          <div><strong>Data Sources:</strong> 3 (Sovereign, Public, Private)</div>
          <div><strong>Coverage:</strong> 6 of 11 indicators (54.5%)</div>
        </div>

        <h3 style={{ fontSize: '1rem', color: '#0066cc', marginTop: '1rem', marginBottom: '0.5rem' }}>What's New in v2.0</h3>
        <ul style={{ margin: 0, lineHeight: '1.6', fontSize: '0.9rem' }}>
          <li>Three economic sectors (sovereign, public, private)</li>
          <li>Enhanced tool coverage (5 → 9 tools)</li>
          <li>Smart data source detection</li>
          <li>Time series analysis</li>
          <li>Seniority analysis</li>
          <li>Multidimensional queries</li>
        </ul>
      </section>

      <footer style={{
        marginTop: '3rem',
        paddingTop: '1.5rem',
        borderTop: '2px solid #e8e8e8',
        color: '#666',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Ready to explore emerging markets credit risk?</strong>
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          Connect the MCP server to Claude Desktop and start asking questions!
        </p>
        <p style={{ margin: '1rem 0 0 0', fontSize: '0.85rem', color: '#999' }}>
          Data from World Bank IFC GEMs Database • Powered by Model Context Protocol
        </p>
      </footer>
    </main>
  );
}
