import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const AUDIT_DIR = path.resolve(__dirname, '..', 'docs', 'MASTER_AUDIT');
const PDF_DIR = path.resolve(AUDIT_DIR, 'pdf');
const TEMP_HTML = path.resolve(AUDIT_DIR, '_temp_render.html');

if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

function getHtmlTemplate(title, markdownContent) {
  // Neutralize script injection and alert dialogs in security test docs
  let sanitizedMarkdown = markdownContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (m) => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .replace(/onerror\s*=\s*['"][^'"]*['"]/gi, 'data-disabled-event="true"')
    .replace(/onload\s*=\s*['"][^'"]*['"]/gi, 'data-disabled-event="true"');

  // Escape backticks and backslashes for JS template literal
  const escapedMarkdown = sanitizedMarkdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script>
    // Disable any modal alerts or prompts in test payloads
    window.alert = function() { console.log('Mocked alert'); };
    window.confirm = function() { return true; };
    window.prompt = function() { return null; };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
      @bottom-left {
        content: "Avencis WFM — Confidential & Proprietary";
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.55;
      font-size: 9.5pt;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    /* Executive Header Banner */
    .executive-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%);
      color: #ffffff;
      padding: 20px 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }
    .brand-group h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .brand-group p {
      margin: 4px 0 0 0;
      font-size: 8.5pt;
      color: #93c5fd;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    .meta-tag {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #ffffff;
    }

    /* Headings */
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      break-after: avoid;
      letter-spacing: -0.3px;
    }
    h1 {
      font-size: 16pt;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 14px;
    }
    h2 {
      font-size: 13pt;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin-top: 20px;
      margin-bottom: 12px;
    }
    h3 {
      font-size: 11pt;
      margin-top: 16px;
      margin-bottom: 8px;
    }

    p { margin: 8px 0; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 14px 0;
      font-size: 8.5pt;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
      background: #0f172a;
      color: #ffffff;
    }
    th {
      padding: 8px 10px;
      font-weight: 600;
      text-align: left;
      font-size: 8pt;
      letter-spacing: 0.3px;
      border-bottom: 1px solid #1e293b;
    }
    tbody tr {
      page-break-inside: avoid;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    tbody tr:hover {
      background-color: #f1f5f9;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      font-size: 7.5pt;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .badge-p0 { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
    .badge-p1 { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .badge-p2 { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
    .badge-p3 { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .badge-status { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
    .badge-notrun { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

    /* Code Blocks */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 14px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 8pt;
      line-height: 1.45;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      color: #38bdf8;
      border: none;
      padding: 0;
    }

    /* Blockquotes / Callouts */
    blockquote {
      margin: 12px 0;
      padding: 10px 14px;
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 0 6px 6px 0;
      color: #1e3a8a;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    blockquote p { margin: 0; }

    /* Mermaid Diagrams */
    .mermaid-container {
      margin: 16px 0;
      padding: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }

    /* Test Scenario Cards */
    .test-card {
      margin: 16px 0;
      border: 1px solid #e2e8f0;
      border-left-width: 5px;
      border-radius: 8px;
      background: #ffffff;
      padding: 14px 16px;
      page-break-inside: avoid;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .test-card.priority-p0 { border-left-color: #ef4444; }
    .test-card.priority-p1 { border-left-color: #f59e0b; }
    .test-card.priority-p2 { border-left-color: #3b82f6; }
    .test-card.priority-p3 { border-left-color: #64748b; }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }
    .card-id {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
    }
    .card-badges {
      display: flex;
      gap: 6px;
    }
  </style>
</head>
<body>
  <div class="executive-banner">
    <div class="brand-group">
      <h1>Avencis Workforce Management</h1>
      <p>Enterprise Product Audit &amp; Master Verification Suite</p>
    </div>
    <div class="meta-tag">Official Compliance Release</div>
  </div>

  <div id="content"></div>

  <script>
    const md = \`${escapedMarkdown}\`;
    
    // Parse markdown using marked
    marked.setOptions({
      gfm: true,
      breaks: false
    });
    
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = marked.parse(md);

    // 1. Process Mermaid diagrams
    document.querySelectorAll('pre code.language-mermaid').forEach(el => {
      const parent = el.parentElement;
      const container = document.createElement('div');
      container.className = 'mermaid-container';
      const mDiv = document.createElement('div');
      mDiv.className = 'mermaid';
      mDiv.textContent = el.textContent;
      container.appendChild(mDiv);
      parent.replaceWith(container);
    });

    // 2. Enhance test case sections (### TC-... or ### TEST-ID...)
    const h3s = Array.from(contentDiv.querySelectorAll('h3'));
    h3s.forEach(h3 => {
      const text = h3.textContent;
      if (text.startsWith('TC-') || text.includes('TC-') || text.includes('TEST-')) {
        const card = document.createElement('div');
        card.className = 'test-card';
        
        // Priority detection
        let prio = 'P1';
        if (text.includes('P0') || (h3.nextElementSibling && h3.nextElementSibling.textContent.includes('P0'))) prio = 'P0';
        else if (text.includes('P2') || (h3.nextElementSibling && h3.nextElementSibling.textContent.includes('P2'))) prio = 'P2';
        else if (text.includes('P3') || (h3.nextElementSibling && h3.nextElementSibling.textContent.includes('P3'))) prio = 'P3';
        card.classList.add('priority-' + prio.toLowerCase());

        // Create Card Header
        const header = document.createElement('div');
        header.className = 'card-header';
        
        const titleSpan = document.createElement('div');
        titleSpan.className = 'card-id';
        titleSpan.textContent = text;
        header.appendChild(titleSpan);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'card-badges';
        badgesDiv.innerHTML = \`<span class="badge badge-\${prio.toLowerCase()}">\${prio}</span> <span class="badge badge-notrun">NOT RUN</span>\`;
        header.appendChild(badgesDiv);

        card.appendChild(header);

        // Collect all siblings until next h3 or h2
        let current = h3.nextElementSibling;
        const toRemove = [];
        while (current && current.tagName !== 'H3' && current.tagName !== 'H2' && current.tagName !== 'HR') {
          toRemove.push(current);
          current = current.nextElementSibling;
        }

        // Put siblings into card
        toRemove.forEach(el => card.appendChild(el));

        // Replace h3 with the complete card
        h3.replaceWith(card);
      }
    });

    // 3. Transform P0/P1/P2 in tables to badges
    document.querySelectorAll('td').forEach(td => {
      const t = td.textContent.trim();
      if (t === 'P0' || t === 'P0 (Critical)' || t === 'P0 (Blocker / Critical Path)') {
        td.innerHTML = '<span class="badge badge-p0">P0</span>';
      } else if (t === 'P1' || t === 'P1 (High)' || t === 'P1 (High / Core Business Functionality)') {
        td.innerHTML = '<span class="badge badge-p1">P1</span>';
      } else if (t === 'P2' || t === 'P2 (Medium)' || t === 'P2 (Medium / Edge Cases & Secondary Paths)') {
        td.innerHTML = '<span class="badge badge-p2">P2</span>';
      } else if (t === 'P3' || t === 'P3 (Low)' || t === 'P3 (Low / Cosmetic & Minor Validation)') {
        td.innerHTML = '<span class="badge badge-p3">P3</span>';
      } else if (t === 'NOT RUN') {
        td.innerHTML = '<span class="badge badge-notrun">NOT RUN</span>';
      } else if (t === 'PASS') {
        td.innerHTML = '<span class="badge badge-status">PASS</span>';
      }
    });

    // Initialize Mermaid
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        flowchart: {
          curve: 'basis',
          htmlLabels: true
        }
      });
      mermaid.run();
    } catch (e) {
      console.error('Mermaid render error:', e);
    }
  </script>
</body>
</html>`;
}

function convertFile(filename, outputPdfName = null) {
  const mdPath = path.join(AUDIT_DIR, filename);
  if (!fs.existsSync(mdPath)) return;

  const mdContent = fs.readFileSync(mdPath, 'utf-8');
  const pdfFilename = outputPdfName || filename.replace(/\.md$/, '.pdf');
  const pdfPath = path.join(PDF_DIR, pdfFilename);

  console.log(`Converting ${filename} -> ${pdfFilename}...`);

  const html = getHtmlTemplate(filename.replace(/\.md$/, ''), mdContent);
  fs.writeFileSync(TEMP_HTML, html, 'utf-8');

  const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --virtual-time-budget=7000 --no-pdf-header-footer --print-to-pdf="${pdfPath}" "file:///${TEMP_HTML.replace(/\\/g, '/')}"`;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 45000 });
    const stats = fs.statSync(pdfPath);
    console.log(`  -> SUCCESS: ${pdfFilename} (${stats.size.toLocaleString()} bytes)`);
    return true;
  } catch (err) {
    console.error(`  -> ERROR converting ${filename}:`, err.message);
    return false;
  }
}

function buildConsolidatedVolumes() {
  console.log("\n--- Building Consolidated Master PDF Volumes ---");

  // Volume 1: Master System Architecture & Security Audit
  const vol1Files = [
    '20_FINAL_PROJECT_HEALTH_REPORT.md',
    '01_COMPLETE_CODEBASE_INVENTORY.md',
    '02_MODULE_FUNCTIONAL_STATUS.md',
    '03_ROLE_PERMISSION_MATRIX.md',
    '04_TENANT_ISOLATION_AND_SECURITY_AUDIT.md',
    '05_END_TO_END_WORKFLOW_MAP.md',
    '06_DATABASE_AND_DATA_INTEGRITY_AUDIT.md',
    '07_ADD_CHANGE_REMOVE_REGISTER.md',
    '19_KNOWN_ISSUES_AND_BLOCKERS.md'
  ];

  let vol1Content = "# AVENCIS WORKFORCE MANAGEMENT\n## MASTER AUDIT & ARCHITECTURE SPECIFICATION (COMPENDIUM)\n\n---\n\n";
  for (const f of vol1Files) {
    const fPath = path.join(AUDIT_DIR, f);
    if (fs.existsSync(fPath)) {
      vol1Content += fs.readFileSync(fPath, 'utf-8') + "\n\n<div style='page-break-after: always;'></div>\n\n";
    }
  }

  const vol1Pdf = '00_AVENCIS_WFM_MASTER_AUDIT_REPORT.pdf';
  const vol1Html = getHtmlTemplate("Avencis WFM Master Audit Report", vol1Content);
  fs.writeFileSync(TEMP_HTML, vol1Html, 'utf-8');
  console.log(`Compiling Volume 1 -> ${vol1Pdf}...`);
  try {
    execSync(`"${CHROME_PATH}" --headless=new --disable-gpu --virtual-time-budget=9000 --no-pdf-header-footer --print-to-pdf="${path.join(PDF_DIR, vol1Pdf)}" "file:///${TEMP_HTML.replace(/\\/g, '/')}"`, { stdio: 'pipe', timeout: 90000 });
    const stats = fs.statSync(path.join(PDF_DIR, vol1Pdf));
    console.log(`  -> SUCCESS: ${vol1Pdf} (${stats.size.toLocaleString()} bytes)`);
  } catch (e) {
    console.error("  -> Error generating Vol 1:", e.message);
  }

  // Volume 2: Complete Manual Testing Programme (245 Test Scenarios)
  const vol2Files = [
    '21_MASTER_TEST_EXECUTION_TRACKER.md',
    '08_TEST_ENVIRONMENT_AND_SYNTHETIC_DATA_PLAN.md',
    '09_MASTER_TEST_SCENARIO_CATALOGUE.md',
    '10_CLIENT_LIFECYCLE_TESTS.md',
    '11_USER_ROLE_MANAGER_TESTS.md',
    '12_EMPLOYEE_LIFECYCLE_TESTS.md',
    '13_ATTENDANCE_AND_POLICY_TESTS.md',
    '14_LEAVE_MANAGEMENT_TESTS.md',
    '15_PAYROLL_TESTS.md',
    '16_CROSS_MODULE_INTEGRATION_TESTS.md',
    '17_SECURITY_NEGATIVE_AND_EDGE_CASE_TESTS.md',
    '18_REPORTING_NOTIFICATION_AUDIT_TESTS.md'
  ];

  let vol2Content = "# AVENCIS WORKFORCE MANAGEMENT\n## MASTER TESTING PROGRAMME & SCENARIO BLUEPRINT (245 SCENARIOS)\n\n---\n\n";
  for (const f of vol2Files) {
    const fPath = path.join(AUDIT_DIR, f);
    if (fs.existsSync(fPath)) {
      vol2Content += fs.readFileSync(fPath, 'utf-8') + "\n\n<div style='page-break-after: always;'></div>\n\n";
    }
  }

  const vol2Pdf = '00_AVENCIS_WFM_MASTER_TESTING_PROGRAMME.pdf';
  const vol2Html = getHtmlTemplate("Avencis WFM Master Testing Programme", vol2Content);
  fs.writeFileSync(TEMP_HTML, vol2Html, 'utf-8');
  console.log(`Compiling Volume 2 -> ${vol2Pdf}...`);
  try {
    execSync(`"${CHROME_PATH}" --headless=new --disable-gpu --virtual-time-budget=9000 --no-pdf-header-footer --print-to-pdf="${path.join(PDF_DIR, vol2Pdf)}" "file:///${TEMP_HTML.replace(/\\/g, '/')}"`, { stdio: 'pipe', timeout: 90000 });
    const stats = fs.statSync(path.join(PDF_DIR, vol2Pdf));
    console.log(`  -> SUCCESS: ${vol2Pdf} (${stats.size.toLocaleString()} bytes)`);
  } catch (e) {
    console.error("  -> Error generating Vol 2:", e.message);
  }
}

async function main() {
  console.log("=== AVENCIS WFM AUDIT PDF GENERATOR ===");
  console.log(`Target Output: ${PDF_DIR}\n`);

  // Ensure Doc 17 is generated
  convertFile('17_SECURITY_NEGATIVE_AND_EDGE_CASE_TESTS.md');

  // Build the two master consolidated volumes
  buildConsolidatedVolumes();

  // Cleanup temp html
  if (fs.existsSync(TEMP_HTML)) {
    fs.unlinkSync(TEMP_HTML);
  }

  console.log("\n=== ALL AUDIT PDFS & VOLUMES READY ===");
}

main().catch(console.error);
