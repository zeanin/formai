const SWAGGER_UI_CDN = 'https://unpkg.com/swagger-ui-dist@5/';

/**
 * Generates the Swagger UI HTML page that loads the spec from /api/doc/spec.json.
 */
export class SwaggerUi {
  generateHtml(specUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Formai API Documentation</title>
  <link rel="stylesheet" type="text/css" href="${SWAGGER_UI_CDN}swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI_CDN}swagger-ui-bundle.js"></script>
  <script src="${SWAGGER_UI_CDN}swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      const ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
  }
}
