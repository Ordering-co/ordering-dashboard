// Public onboarding prompt: intentionally independent of client, tenant and credentials.
export const MCP_SETUP_PROMPT = 'Connect me to Ordering.co: clone https://github.com/Ordering-co/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.'

export const buildMcpSetupPrompt = () => MCP_SETUP_PROMPT
