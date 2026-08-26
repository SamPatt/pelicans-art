# Security

## Supported surface

The static site and current default branch receive security fixes. The local Express authoring server is designed for a trusted machine or private network and must not be exposed directly to the public internet.

Browser-mode provider keys are stored in that browser's local storage and sent directly to the selected provider. They are not sent to pelicans.art. Treat community SVG and imported project files as untrusted input; the application sanitizes SVG before inline rendering.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Report a vulnerability** feature in the repository Security tab. Do not include live credentials in an issue, commit, screenshot, or sample file. Revoke an exposed credential before doing anything else.
