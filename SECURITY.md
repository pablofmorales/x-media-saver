# Security Policy

## Supported Versions

Only the latest published version of the Social Media Saver extension is actively supported for security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in this extension, **do not open a public issue**. 

Please report it privately to the maintainers at **security@blackasteroid.com.ar**. We aim to respond within 48 hours and provide a fix or mitigation within 7 days for critical issues.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will credit you in the release notes unless you prefer to remain anonymous.

## Security Considerations

- **Permissions:** The extension uses `downloads`, `activeTab`, `storage`, and `notifications`. It requires host permissions for specific domains (X and Reddit media domains) to fetch the highest quality media directly. It does not request `<all_urls>`.
- **Content Scripts:** Content scripts run in the context of the user's active tab but do not inject executable script tags or use `eval()`.
- **Message Passing:** The `chrome.runtime.onMessage` listener validates `sender.id` to ensure it only accepts messages from its own content scripts, preventing cross-extension interference or arbitrary download triggers from untrusted tabs.
- **Media URLs:** URLs returned from third-party APIs (like `api.vxtwitter.com`) are validated to ensure they use the `https:` protocol before being passed to the `chrome.downloads` API.
