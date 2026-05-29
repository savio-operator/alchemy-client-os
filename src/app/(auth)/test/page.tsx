export default function TestPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Test Page Works</h1>
      <p>If you see this, the root layout and server rendering work fine.</p>
      <p>Node: {process.version}</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}
