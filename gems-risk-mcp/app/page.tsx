import Link from 'next/link';

export default function Home() {
  return (
    <main style={{
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1000px',
      margin: '0 auto',
      lineHeight: '1.6'
    }}>
      <header style={{
        textAlign: 'center',
        borderBottom: '3px solid #0066cc',
        paddingBottom: '2rem',
        marginBottom: '3rem'
      }}>
        <h1 style={{
          color: '#0066cc',
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          fontWeight: '700'
        }}>
          Akgunay Labs MCP Servers
        </h1>
        <p style={{
          fontSize: '1.3rem',
          color: '#555',
          margin: '0.5rem 0 0 0'
        }}>
          Model Context Protocol servers for AI assistants
        </p>
        <code style={{
          display: 'inline-block',
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: '6px',
          color: '#0066cc',
          fontSize: '1rem'
        }}>
          mcp.akgunaylabs.io
        </code>
      </header>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#333', fontSize: '1.8rem', marginBottom: '1.5rem' }}>Available MCP Servers</h2>

        <div style={{
          display: 'grid',
          gap: '1.5rem'
        }}>
          {/* GEMs Risk MCP Card */}
          <Link href="/gems-risk" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e8f4f8 100%)',
              border: '2px solid #0066cc',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  fontSize: '3rem',
                  lineHeight: '1'
                }}>
                  📊
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    color: '#0066cc',
                    fontSize: '1.5rem',
                    marginTop: 0,
                    marginBottom: '0.5rem'
                  }}>
                    IFC GEMs Risk
                  </h3>
                  <p style={{
                    color: '#555',
                    fontSize: '1.1rem',
                    marginBottom: '1rem',
                    lineHeight: '1.6'
                  }}>
                    Emerging markets credit risk data from the World Bank's IFC Global Emerging Markets Risk Database
                  </p>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      9 tools
                    </span>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      7 regions
                    </span>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#fff',
                      border: '1px solid #d1d5db',
                      borderRadius: '999px',
                      fontSize: '0.85rem',
                      color: '#666'
                    }}>
                      40+ years of data
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: '#666'
                  }}>
                    <div>
                      <strong>Endpoint:</strong>{' '}
                      <code style={{
                        background: '#fff',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        color: '#0066cc'
                      }}>
                        /api/gems-risk/mcp
                      </code>
                    </div>
                  </div>
                  <div style={{
                    marginTop: '1rem',
                    color: '#0066cc',
                    fontWeight: '600',
                    fontSize: '0.95rem'
                  }}>
                    View Documentation →
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Coming Soon Card */}
          <div style={{
            padding: '2rem',
            background: '#f8f9fa',
            border: '2px dashed #d1d5db',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              opacity: 0.5
            }}>
              🚀
            </div>
            <h3 style={{
              color: '#666',
              fontSize: '1.3rem',
              marginTop: 0,
              marginBottom: '0.5rem'
            }}>
              More MCP Servers Coming Soon
            </h3>
            <p style={{
              color: '#888',
              fontSize: '0.95rem',
              margin: 0
            }}>
              Additional data sources and AI tools in development
            </p>
          </div>
        </div>
      </section>

      <section style={{
        marginBottom: '3rem',
        background: '#f0f5ff',
        padding: '2rem',
        borderRadius: '12px',
        border: '1px solid #adc6ff'
      }}>
        <h2 style={{ color: '#333', fontSize: '1.5rem', marginTop: 0, marginBottom: '1rem' }}>
          What are MCP Servers?
        </h2>
        <p style={{ color: '#555', marginBottom: '1rem' }}>
          <strong>Model Context Protocol (MCP)</strong> servers enable AI assistants like Claude to access external data sources and tools. Each MCP server provides specialized capabilities through a standardized interface.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          <div>
            <strong style={{ color: '#0066cc' }}>🔌 Easy Integration</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              Connect to Claude Desktop or any MCP-compatible client
            </p>
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>🔒 Secure</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              Read-only access to public data sources
            </p>
          </div>
          <div>
            <strong style={{ color: '#0066cc' }}>⚡ Real-time</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              Live data from authoritative sources
            </p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: '#333', fontSize: '1.5rem', marginBottom: '1rem' }}>
          Quick Start
        </h2>
        <div style={{
          background: '#f8f9fa',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid #e1e4e8'
        }}>
          <p style={{ margin: '0 0 1rem 0', color: '#555' }}>
            To connect an MCP server to Claude Desktop:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#555', lineHeight: '1.8' }}>
            <li>Open your Claude Desktop configuration file</li>
            <li>Add the server configuration (see individual MCP documentation)</li>
            <li>Restart Claude Desktop</li>
            <li>Start asking questions using the MCP's data!</li>
          </ol>
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fff',
            borderRadius: '6px',
            border: '1px solid #d1d5db'
          }}>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
              Config file location (macOS):
            </div>
            <code style={{
              display: 'block',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: '#0066cc'
            }}>
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>
          </div>
        </div>
      </section>

      <footer style={{
        marginTop: '4rem',
        paddingTop: '2rem',
        borderTop: '2px solid #e8e8e8',
        textAlign: 'center',
        color: '#666'
      }}>
        <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
          <strong>Akgunay Labs MCP Servers</strong>
        </p>
        <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: '#888' }}>
          Powered by Model Context Protocol • Built with Next.js
        </p>
      </footer>
    </main>
  );
}
